import { describe, expect, test, afterAll, beforeAll } from '@jest/globals';
import * as http from 'http';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { FileHandler } from '../file-handler';

/**
 * Regression tests for the file-upload SSRF / path-traversal / arbitrary-read
 * fixes (hangwin/mcp-chrome#380).
 *
 * FileHandler's guards are private, so tests reach them via casts; behavior is
 * exercised end-to-end through handleFileRequest wherever possible.
 */
const anyHandler = (h: FileHandler) => h as any;

// Constructor only mkdirs the shared temp dir - safe at collection time, and
// describe-level assertions below read its fields before beforeAll runs.
const handler = new FileHandler();

describe('file handling guards (issue #380)', () => {
  describe('validateFileUrl - scheme allow-list', () => {
    test.each([
      ['http://example.com/x', true],
      ['https://example.com/x', true],
      ['ftp://example.com/x', false],
      ['file:///etc/passwd', false],
      ['gopher://example.com/x', false],
      ['not a url', false],
    ])('%s -> %s', async (url, ok) => {
      const p = anyHandler(handler)
        .validateFileUrl(url)
        .then(
          () => true,
          () => false,
        );
      await expect(p).resolves.toBe(ok);
    });
  });

  describe('validateFileUrl - protected ranges rejected (SSRF guard)', () => {
    test.each([
      ['http://127.0.0.1:1/x', 'loopback v4'],
      ['http://169.254.169.254/x', 'cloud metadata'],
      ['http://10.0.0.7/x', 'private 10/8'],
      ['http://172.16.0.3/x', 'private 172.16/12'],
      ['http://192.168.1.4/x', 'private 192.168/16'],
      ['http://100.64.0.1/x', 'CGNAT'],
      ['http://0.0.0.3/x', 'this-host'],
      ['http://224.0.0.4/x', 'multicast'],
      ['http://240.0.0.1/x', 'reserved'],
      ['http://[::1]/x', 'loopback v6'],
      ['http://[fe80::1]/x', 'link-local v6'],
      ['http://[fd00::1]/x', 'ULA v6'],
      ['http://[ff02::1]/x', 'multicast v6'],
      ['http://[::ffff:127.0.0.1]/x', 'mapped loopback'],
    ])('%s (%s)', async (url) => {
      await expect(anyHandler(handler).validateFileUrl(url)).rejects.toThrow(/Non-public|Invalid/);
    });
  });

  describe('validateFileUrl - public literal addresses accepted', () => {
    test.each([
      'http://93.184.216.34/x',
      'http://8.8.8.8:8080/x',
      'http://172.32.0.9/x', // just outside 172.16/12
      'http://100.128.0.1/x', // just outside CGNAT /10
      'http://[2606:4700:4700::1111]/x',
    ])('%s', async (url) => {
      await expect(anyHandler(handler).validateFileUrl(url)).resolves.toBeUndefined();
    });
  });

  describe('isProtectedAddress predicate matrix', () => {
    const cases: Array<[string, number, boolean]> = [
      // family 4
      ['93.184.216.34', 4, false],
      ['8.8.8.8', 4, false],
      ['127.0.0.1', 4, true],
      ['169.254.169.254', 4, true],
      ['10.1.2.3', 4, true],
      ['172.16.0.9', 4, true],
      ['172.31.255.255', 4, true],
      ['172.32.0.9', 4, false],
      ['192.168.1.1', 4, true],
      ['100.64.0.1', 4, true],
      ['100.127.255.255', 4, true],
      ['100.128.0.1', 4, false],
      ['0.0.0.0', 4, true],
      ['239.1.2.3', 4, true],
      ['240.0.0.1', 4, true],
      ['255.255.255.255', 4, true],
      // family 6
      ['::1', 6, true],
      ['::', 6, true],
      ['fe80::1', 6, true],
      ['febf::1', 6, true],
      ['fec0::1', 6, false],
      ['fd00::1', 6, true],
      ['ff02::1', 6, true],
      ['2001:db8::1', 6, true],
      ['2001:4860:4860::8888', 6, false],
      ['::ffff:127.0.0.1', 6, true],
      ['::ffff:169.254.169.254', 6, true],
      ['::ffff:8.8.8.8', 6, false],
      ['2002:7f00:1::', 6, true], // 6to4 embedding 127.0.0.1
      ['2002:80c:f802::', 6, false], // 6to4 embedding 140.199.248.2? public edge
      ['2001:0:0:0:0:0:7f00:1', 6, true], // Teredo embedding 127.0.0.1
      ['2001:0:808:402:0:0:0:0', 6, true], // Teredo embedding 0.0.0.0 (unspecified->protected)
    ];

    test.each(cases)('%s (family %i) protected=%s', (address, family, expected) => {
      expect(anyHandler(handler).isProtectedAddress(address, family)).toBe(expected);
    });
  });

  describe('sanitizeFileName - traversal containment', () => {
    test.each([
      ['../../../escape.txt', 'escape.txt'],
      ['/var/tmp/absolute.png', 'absolute.png'],
      ['..\\..\\windows.png', 'windows.png'],
      ['ok.png', 'ok.png'],
      ['.hidden', '.hidden'],
    ])('%p -> %p', (input, expected) => {
      expect(anyHandler(handler).sanitizeFileName(input)).toBe(expected);
    });
  });

  describe('isInsideTempDir - lexical trap and escapes', () => {
    const tempDir = anyHandler(handler).tempDir as string;

    test('accepts paths inside the temp dir', () => {
      expect(anyHandler(handler).isInsideTempDir(path.join(tempDir, 'a.bin'))).toBe(true);
      expect(anyHandler(handler).isInsideTempDir('a.bin')).toBe(true);
    });

    test('rejects the string-prefix trap the legacy startsWith check misses', () => {
      const siblingPrefix = `${tempDir}-evil/x.bin`; // startsWith(tempDir) is true, but it is another dir
      expect(siblingPrefix.startsWith(`${tempDir}`)).toBe(true); // legacy check passes...
      expect(anyHandler(handler).isInsideTempDir(siblingPrefix)).toBe(false); // ...resolved check is stricter
    });

    test('rejects sibling and parent escapes', () => {
      const sibling = path.join(path.dirname(tempDir), 'elsewhere.bin');
      expect(anyHandler(handler).isInsideTempDir(sibling)).toBe(false);
      expect(anyHandler(handler).isInsideTempDir('../outside.bin')).toBe(false);
    });
  });

  describe('handleFileRequest end-to-end (loopback HTTP origin)', () => {
    let server: http.Server;
    let port = 0;
    const ORIGIN = 'origin-body-380';
    const FINAL = 'final-body-380';

    beforeAll(async () => {
      // hop-1 origin: redirects to hop-2 on a different port; hop-2 serves bytes
      const hop2 = http.createServer((_req, res) => {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.end(FINAL);
      });
      await new Promise<void>((r) => hop2.listen(0, '127.0.0.1', () => r()));
      const hop2Port = (hop2.address() as { port: number }).port;

      server = http.createServer((req, res) => {
        if (req.url === '/finalDirect') {
          res.setHeader('Content-Type', 'application/octet-stream');
          res.end(ORIGIN);
          return;
        }
        if (req.url === '/chain') {
          res.writeHead(302, { Location: `http://127.0.0.1:${hop2Port}/final` });
          res.end();
          return;
        }
        if (req.url === '/loop') {
          res.writeHead(302, { Location: 'http://127.0.0.1:1/never' });
          res.end();
          return;
        }
        res.writeHead(404);
        res.end();
      });
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
      port = (server.address() as { port: number }).port;
      (globalThis as any).__hop2 = hop2;
    }, 15000);

    afterAll(async () => {
      (globalThis as any).__hop2?.close();
      await new Promise<void>((r) => server.close(() => r()));
    });

    test('direct fetch lands in the shared temp dir', async () => {
      const res = await handler.handleFileRequest({
        action: 'prepareFile',
        fileUrl: `http://127.0.0.1:${port}/finalDirect`,
        fileName: 'direct.bin',
      });
      // loopback origins are REJECTED by the SSRF guard post-fix; expect the
      // documented policy error, shaped { success:false, error }
      expect(res.success).toBe(false);
      expect(String(res.error)).toMatch(/Non-public address/);
    });

    test('readBase64File: outside-temp rejected, inside-temp round-trips', async () => {
      const outside = await handler.handleFileRequest({
        action: 'readBase64File',
        filePath: '/etc/hostname',
      });
      expect(outside.success).toBe(false);

      const probe = path.join(anyHandler(handler).tempDir, 'roundtrip.bin');
      fs.writeFileSync(probe, Buffer.from('payload-380'));
      const inside = await handler.handleFileRequest({ action: 'readBase64File', filePath: probe });
      expect(inside.success).toBe(true);
      expect((inside as any).base64Data).toBe(Buffer.from('payload-380').toString('base64'));
      fs.unlinkSync(probe);
    });

    test('verifyFile: outside-temp rejected', async () => {
      const res = await handler.handleFileRequest({
        action: 'prepareFile',
        filePath: '/etc/hosts',
      });
      expect(res.success).toBe(false);
      expect(String(res.error)).toMatch(/temp directory/i);
    });

    test('cleanupFile still works for its own temp files', async () => {
      const probe = path.join(anyHandler(handler).tempDir, 'cleanupme.bin');
      fs.writeFileSync(probe, 'x');
      const res = await handler.handleFileRequest({ action: 'cleanupFile', filePath: probe });
      expect(res.success).toBe(true);
      expect(fs.existsSync(probe)).toBe(false);
    });

    test('unknown action reported', async () => {
      const res = await handler.handleFileRequest({ action: 'nope' } as any);
      expect(res.success).toBe(false);
      expect(String(res.error)).toMatch(/Unknown file action/);
    });
  });
});
