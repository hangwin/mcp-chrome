import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as dns from 'dns';
import * as net from 'net';
import fetch from 'node-fetch';

/**
 * File handler for managing file uploads through the native messaging host
 */
export class FileHandler {
  private tempDir: string;

  constructor() {
    // Create a temp directory for file operations
    this.tempDir = path.join(os.tmpdir(), 'chrome-mcp-uploads');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Handle file preparation request from the extension
   */
  async handleFileRequest(request: any): Promise<any> {
    const { action, fileUrl, base64Data, fileName, filePath, traceFilePath, insightName } = request;

    try {
      switch (action) {
        case 'prepareFile':
          if (fileUrl) {
            return await this.downloadFile(fileUrl, fileName);
          } else if (base64Data) {
            return await this.saveBase64File(base64Data, fileName);
          } else if (filePath) {
            return await this.verifyFile(filePath);
          }
          break;

        case 'readBase64File': {
          if (!filePath) return { success: false, error: 'filePath is required' };
          return await this.readBase64File(filePath);
        }

        case 'cleanupFile':
          return await this.cleanupFile(filePath);

        case 'analyzeTrace': {
          const targetPath = traceFilePath || filePath;
          if (!targetPath) {
            return { success: false, error: 'traceFilePath is required' };
          }
          try {
            // With tsconfig moduleResolution=NodeNext, relative ESM imports need explicit .js extension
            const { analyzeTraceFile } = await import('./trace-analyzer.js');
            const res = await analyzeTraceFile(targetPath, insightName);
            return { success: true, ...res };
          } catch (e: any) {
            return { success: false, error: e?.message || String(e) };
          }
        }

        default:
          return {
            success: false,
            error: `Unknown file action: ${action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Download a file from URL and save to temp directory
   */
  private async downloadFile(fileUrl: string, fileName?: string): Promise<any> {
    try {
      await this.validateFileUrl(fileUrl);
      const response = await fetch(fileUrl, { redirect: 'manual' });
      let finalResponse = response;

      // Follow redirects manually so every hop is re-validated against the same policy
      // (a 3xx to 169.254.169.254 or 127.0.0.1 must not bypass the check above)
      for (let hop = 0; hop < FileHandler.MAX_REDIRECTS; hop++) {
        const status = finalResponse.status;
        if (
          status !== 301 &&
          status !== 302 &&
          status !== 303 &&
          status !== 307 &&
          status !== 308
        ) {
          break;
        }
        const location = finalResponse.headers.get('location');
        if (!location) break;
        const nextUrl = new URL(location, finalResponse.url || fileUrl).toString();
        await this.validateFileUrl(nextUrl);
        finalResponse = await fetch(nextUrl, { redirect: 'manual' });
      }

      if (!finalResponse.ok) {
        throw new Error(`Failed to download file: ${finalResponse.statusText}`);
      }

      // Generate filename if not provided
      const finalFileName = this.sanitizeFileName(fileName || this.generateFileName(fileUrl));
      const filePath = path.join(this.tempDir, finalFileName);

      // Get the file buffer
      const buffer = await finalResponse.buffer();

      // Save to file
      fs.writeFileSync(filePath, buffer);

      return {
        success: true,
        filePath: filePath,
        fileName: finalFileName,
        size: buffer.length,
      };
    } catch (error) {
      throw new Error(`Failed to download file from URL: ${error}`);
    }
  }

  private static readonly ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

  // Ranges the SSRF guard treats as NOT publicly routable (issue #380):
  // loopback incl. IPv6 ::1 / mapped ::ffff:127/8, link-local (169.254/16
  // cloud metadata, fe80::/10), unspecified, RFC1918, CGNAT 100.64/10,
  // multicast/reserved/broadcast, IPv4-mapped, documentation-only
  // 2001:db8::/32, and deprecated tunnels (Teredo 2001::/32, 6to4
  // 2002::/16) whose embedded v4 can be loopback.
  private static readonly PROTECTED_V4_RANGES: Array<[string, number, string]> = [
    ['127.0.0.0', 8, 'loopback'],
    ['10.0.0.0', 8, 'private'],
    ['172.16.0.0', 12, 'private'],
    ['192.168.0.0', 16, 'private'],
    ['169.254.0.0', 16, 'link-local (cloud metadata)'],
    ['100.64.0.0', 10, 'CGNAT'],
    ['224.0.0.0', 4, 'multicast'],
    ['240.0.0.0', 4, 'reserved'],
    ['255.255.255.255', 32, 'broadcast'],
    ['0.0.0.0', 8, 'this-host'],
  ];

  private static readonly MAX_REDIRECTS = 5;

  /**
   * SSRF guard for LLM-supplied file_url (see issue #380):
   * allow only http/https, resolve every hostname (A/AAAA) to a public
   * unicast address, and reject loopback / link-local / private / metadata
   * targets. Applied to the initial URL and re-applied to every redirect hop.
   */
  private async validateFileUrl(rawUrl: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error(`Invalid URL: ${rawUrl}`);
    }

    if (!FileHandler.ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      throw new Error(
        `Unsupported protocol '${parsed.protocol}' in fileUrl (allowed: http, https): ${rawUrl}`,
      );
    }

    const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      throw new Error(`Invalid port in fileUrl: ${rawUrl}`);
    }

    const host =
      parsed.hostname.startsWith('[') && parsed.hostname.endsWith(']')
        ? parsed.hostname.slice(1, -1)
        : parsed.hostname;

    // Percent-encoded hostnames are ambiguous (a %32%37%.%30%2e%31 label can
    // bypass textual checks while resolving differently) - keep it simple.
    if (host.includes('%')) {
      throw new Error(`Unsupported percent-encoded host in fileUrl: ${rawUrl}`);
    }

    const addresses = await this.resolveHostAddresses(host);

    for (const { address, family } of addresses) {
      if (this.isProtectedAddress(address, family)) {
        throw new Error(
          `Non-public address '${address}' for host '${host}' in fileUrl (SSRF guard rejects ` +
            `loopback/link-local/private ranges; see issue #380): ${rawUrl}`,
        );
      }
    }
  }

  private async resolveHostAddresses(
    host: string,
  ): Promise<Array<{ address: string; family: number }>>;
  private async resolveHostAddresses(
    host: string,
  ): Promise<Array<{ address: string; family: number }>> {
    if (net.isIP(host)) {
      return [{ address: host, family: net.isIP(host) }];
    }

    try {
      const records = await dns.promises.resolve6(host);
      const v6 = records.map((address) => ({ address, family: 6 }));
      if (v6.length > 0) return v6;
    } catch {
      // fall through to A / handle below
    }

    try {
      const v4 = (await dns.promises.resolve4(host)).map((address) => ({ address, family: 4 }));
      if (v4.length > 0) return v4;
    } catch {
      // fall through
    }

    throw new Error(`Unable to resolve host in fileUrl: ${host}`);
  }

  /**
   * True when the address is NOT publicly routable (see issue #380):
   * IPv6 loopback/unspecified/multicast/ULA/link-local/documentation and
   * IPv4 loopback/link-local (cloud metadata)/private/CGNAT/reserved/
   * broadcast/this-host, plus IPv4 embedded in those v6 forms.
   */
  private isProtectedAddress(address: string, family: number): boolean {
    if (family === 6) {
      const lower = address.toLowerCase();

      // Dotted-v4 suffix forms ('::ffff:127.0.0.1', '::127.0.0.1'): rewrite the
      // trailing dotted quad as two hex groups so one path handles all shapes.
      const dotted = /(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/.exec(lower);
      let normalized = lower;
      if (dotted) {
        const [hi, lo] = dotted[1].split('.').reduce<[string, string]>(
          (acc, octet, idx) => {
            acc[idx < 2 ? 0 : 1] += Number(octet).toString(16).padStart(2, '0');
            return acc;
          },
          ['', ''],
        );
        normalized = lower.slice(0, dotted.index) + ':' + hi + ':' + lo;
      }

      // Expand '::' once; classification then uses fixed group indices.
      const halves = normalized.split('::');
      if (halves.length > 2) return false;
      const head = halves[0] ? halves[0].split(':') : [];
      const tail = halves[1] ? halves[1].split(':') : [];
      if (head.concat(tail).some((g) => g && !/^[0-9a-f]{1,4}$/.test(g))) return false;
      const fill = new Array<string>(Math.max(0, 8 - head.length - tail.length)).fill('0');
      const groups = [...head, ...fill, ...tail].map((g) => g.padStart(4, '0'));
      if (groups.length !== 8) return false;

      // Unspecified :: and loopback ::1 (seven zero groups then 1).
      if (groups.every((g) => g === '0000')) return true;
      if (groups.slice(0, 7).every((g) => g === '0000')) return true;

      // IPv4-mapped/compatible (::ffff:a.b.c or hex equivalent, also ::a.b.c
      // with <6 prefix groups): the embedded IPv4 decides.
      const nonZero = groups.filter((g) => g !== '0000');
      if (
        groups[5] === 'ffff' &&
        groups.slice(0, 5).every((g) => g === '0000') &&
        groups.slice(6).every((g) => g !== '0000')
      ) {
        return this.isProtectedAddress(this.compactHexv4(groups[6], groups[7]) ?? '', 4);
      }
      if (
        groups.slice(0, 5).every((g) => g === '0000') &&
        groups[5] !== 'ffff' &&
        nonZero.length === 3
      ) {
        // IPv4-compatible (::a.b.c hex): deprecated but seen in the wild.
        return this.isProtectedAddress(this.compactHexv4(groups[6], groups[7]) ?? '', 4);
      }

      const h = groups.join(':');
      if (h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb'))
        return true; // fe80::/10 link-local
      if (h.startsWith('fec')) return false; // deprecated fec0::/10 site-local: routable
      if (h.startsWith('fc0') || h.startsWith('fd0')) {
        // fc00::/7 ULA - first group fc00..fdff
        return true;
      }
      if (h.startsWith('ff0')) return true; // multicast ff00::/8 - group ff00..ffff
      if (h.startsWith('2002:')) {
        // 6to4: embedded dest IPv4 = groups 2-3.
        return this.isProtectedAddress(this.compactHexv4(groups[1], groups[2]) ?? '', 4);
      }
      if (h.startsWith('2001:0000')) {
        // Teredo: client IPv4 = last two groups (flags/port ignored).
        return this.isProtectedAddress(this.compactHexv4(groups[6], groups[7]) ?? '', 4);
      }
      if (h.startsWith('2001:0db8')) return true; // documentation-only 2001:db8::/32

      return false; // every other global unicast v6 -> publicly routable
    }

    const parts = address.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) {
      return false;
    }
    return FileHandler.PROTECTED_V4_RANGES.some(([base, bits]) =>
      this.isProtectedIpv4(parts, base, bits),
    );
  }

  private isProtectedIpv4(addr: number[], baseStr: string, prefixLen: number): boolean {
    const base = baseStr.split('.').map((p) => parseInt(p, 10));
    const fullBytes = Math.floor(prefixLen / 8);
    for (let i = 0; i < fullBytes; i++) {
      if (addr[i] !== base[i]) return false;
    }
    const rem = prefixLen % 8;
    if (rem > 0) {
      const mask = 0b11111111 << (8 - rem);
      if ((addr[fullBytes] & mask) !== (base[fullBytes] & mask)) return false;
    }
    return true;
  }

  /**
   * Convert a 4-hex-digit group pair to dotted quad ('7f00'+'0001' -> 127.0.0.1)
   * for 6to4/Teredo embedded-v4 checks; null unless both groups are hex.
   */
  private compactHexv4(high: string, low?: string): string | null {
    const groups = low === undefined ? [high.slice(0, 4), high.slice(4, 8)] : [high, low];
    if (groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
    const bytes = groups.flatMap((g) => [
      parseInt(g.padStart(4, '0').slice(0, 2), 16),
      parseInt(g.padStart(4, '0').slice(2, 4), 16),
    ]);
    return bytes.join('.');
  }

  /**
   * Restrict caller-provided file names to a single path segment inside the
   * temp dir (see issue #380): absolute paths and ../ walks must not escape
   * via path.join(tempDir, fileName).
   */
  private sanitizeFileName(fileName: string): string {
    return path.basename(fileName.replace(/\\/g, '/'));
  }

  /**
   * Save base64 data as a file
   */
  private async saveBase64File(base64Data: string, fileName?: string): Promise<any> {
    try {
      // Remove data URL prefix if present
      const base64Content = base64Data.replace(/^data:.*?;base64,/, '');

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Content, 'base64');

      // Generate filename if not provided
      const finalFileName = this.sanitizeFileName(fileName || `upload-${Date.now()}.bin`);
      const filePath = this.sanitizeFilePath(path.join(this.tempDir, finalFileName));

      // Save to file
      fs.writeFileSync(filePath, buffer);

      return {
        success: true,
        filePath: filePath,
        fileName: finalFileName,
        size: buffer.length,
      };
    } catch (error) {
      throw new Error(`Failed to save base64 file: ${error}`);
    }
  }

  /**
   * Verify that a file exists and is accessible
   */
  private async verifyFile(filePath: string): Promise<any> {
    try {
      // Only allow verification of files in our temp directory (same policy
      // as cleanupFile - tool-argument paths must not reach arbitrary files)
      if (!this.isInsideTempDir(filePath)) {
        throw new Error('Can only verify files in temp directory');
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      // Get file stats
      const stats = fs.statSync(filePath);

      // Check if it's actually a file
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      // Check if file is readable
      fs.accessSync(filePath, fs.constants.R_OK);

      return {
        success: true,
        filePath: filePath,
        fileName: path.basename(filePath),
        size: stats.size,
      };
    } catch (error) {
      throw new Error(`Failed to verify file: ${error}`);
    }
  }

  /**
   * Read file content and return as base64 string
   */
  private async readBase64File(filePath: string): Promise<any> {
    try {
      /**
       * Arbitrary-read guard (see issue #380): only files inside our temp dir
       * may be read. cleanupFile enforces this; readBase64File did not.
       */
      if (!this.isInsideTempDir(filePath)) {
        return {
          success: false,
          error: 'Can only read files in temp directory',
        };
      }
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }
      const buf = fs.readFileSync(filePath);
      const base64 = buf.toString('base64');
      return {
        success: true,
        filePath,
        fileName: path.basename(filePath),
        size: stats.size,
        base64Data: base64,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Lexically-normalizing containment check for tool-supplied paths.
   * Superset of the legacy startsWith(tempDir) check: a path that only
   * *lexically* starts with tempDir (e.g. "..ar/tmp/x" when tempDir is
   * "/tmp/x/chrome-mcp-uploads") must not pass. Resolves .. segments and
   * checks segment-wise against the real temp dir.
   */
  private isInsideTempDir(candidate: string): boolean {
    const resolved = path.resolve(this.tempDir, candidate);
    const baseWithSep = this.tempDir + path.sep;
    return resolved.startsWith(baseWithSep);
  }

  /**
   * Escape-proof a path the caller already scoped to tempDir: .. segments
   * (from '../../x'-style names) are resolved against tempDir, then the
   * result is re-checked so the resolved location is guaranteed inside.
   */
  private sanitizeFilePath(candidate: string): string {
    const resolved = path.resolve(this.tempDir, candidate);
    if (!this.isInsideTempDir(resolved)) {
      throw new Error(`Resolved path escapes temp directory: ${candidate}`);
    }
    return resolved;
  }

  /**
   * Clean up a temporary file
   */
  private async cleanupFile(filePath: string): Promise<any> {
    try {
      // Only allow cleanup of files in our temp directory
      if (!this.isInsideTempDir(filePath)) {
        return {
          success: false,
          error: 'Can only cleanup files in temp directory',
        };
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return {
        success: true,
        message: 'File cleaned up successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to cleanup file: ${error}`,
      };
    }
  }

  /**
   * Generate a filename from URL or create a unique one
   */
  private generateFileName(url?: string): string {
    if (url) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const basename = path.basename(pathname);
        if (basename && basename !== '/') {
          // Add random suffix to avoid collisions
          const ext = path.extname(basename);
          const name = path.basename(basename, ext);
          const randomSuffix = crypto.randomBytes(4).toString('hex');
          return `${name}-${randomSuffix}${ext}`;
        }
      } catch {
        // Invalid URL, fall through to generate random name
      }
    }

    // Generate random filename
    return `upload-${crypto.randomBytes(8).toString('hex')}.bin`;
  }

  /**
   * Clean up old temporary files (older than 1 hour)
   */
  cleanupOldFiles(): void {
    try {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > oneHour) {
          fs.unlinkSync(filePath);
          // Use stderr to avoid polluting stdout (Native Messaging protocol)
          console.error(`Cleaned up old temp file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }
}

export default new FileHandler();
