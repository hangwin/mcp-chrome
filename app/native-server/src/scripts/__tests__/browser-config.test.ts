import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import * as os from 'os';
import * as fs from 'fs';
import { execSync } from 'child_process';
import {
  BrowserType,
  getBrowserConfig,
  detectInstalledBrowsers,
  parseBrowserType,
  getAllBrowserConfigs,
} from '../browser-config';

// Mock modules
jest.mock('os');
jest.mock('fs');
jest.mock('child_process');

const mockedOs = os as jest.Mocked<typeof os>;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('Browser Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBrowserConfig', () => {
    describe('Linux', () => {
      beforeEach(() => {
        mockedOs.platform.mockReturnValue('linux');
        mockedOs.homedir.mockReturnValue('/home/testuser');
      });

      test('returns correct paths for Chrome', () => {
        const config = getBrowserConfig(BrowserType.CHROME);

        expect(config.type).toBe(BrowserType.CHROME);
        expect(config.displayName).toBe('Chrome');
        expect(config.userManifestPath).toBe(
          '/home/testuser/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json',
        );
        expect(config.systemManifestPath).toBe(
          '/etc/opt/chrome/native-messaging-hosts/com.chromemcp.nativehost.json',
        );
        expect(config.registryKey).toBeUndefined();
      });

      test('returns correct paths for Chromium', () => {
        const config = getBrowserConfig(BrowserType.CHROMIUM);

        expect(config.type).toBe(BrowserType.CHROMIUM);
        expect(config.displayName).toBe('Chromium');
        expect(config.userManifestPath).toBe(
          '/home/testuser/.config/chromium/NativeMessagingHosts/com.chromemcp.nativehost.json',
        );
        expect(config.systemManifestPath).toBe(
          '/etc/chromium/native-messaging-hosts/com.chromemcp.nativehost.json',
        );
        expect(config.registryKey).toBeUndefined();
      });
    });

    describe('macOS', () => {
      beforeEach(() => {
        mockedOs.platform.mockReturnValue('darwin');
        mockedOs.homedir.mockReturnValue('/Users/testuser');
      });

      test('returns correct paths for Chrome', () => {
        const config = getBrowserConfig(BrowserType.CHROME);

        expect(config.type).toBe(BrowserType.CHROME);
        expect(config.displayName).toBe('Chrome');
        expect(config.userManifestPath).toBe(
          '/Users/testuser/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.chromemcp.nativehost.json',
        );
        expect(config.systemManifestPath).toBe(
          '/Library/Google/Chrome/NativeMessagingHosts/com.chromemcp.nativehost.json',
        );
        expect(config.registryKey).toBeUndefined();
      });

      test('returns correct paths for Chromium', () => {
        const config = getBrowserConfig(BrowserType.CHROMIUM);

        expect(config.type).toBe(BrowserType.CHROMIUM);
        expect(config.displayName).toBe('Chromium');
        expect(config.userManifestPath).toBe(
          '/Users/testuser/Library/Application Support/Chromium/NativeMessagingHosts/com.chromemcp.nativehost.json',
        );
        expect(config.systemManifestPath).toBe(
          '/Library/Application Support/Chromium/NativeMessagingHosts/com.chromemcp.nativehost.json',
        );
        expect(config.registryKey).toBeUndefined();
      });
    });

    describe('Windows', () => {
      beforeEach(() => {
        mockedOs.platform.mockReturnValue('win32');
        mockedOs.homedir.mockReturnValue('C:\\Users\\testuser');
        process.env.APPDATA = 'C:\\Users\\testuser\\AppData\\Roaming';
        process.env.ProgramFiles = 'C:\\Program Files';
      });

      test('returns correct paths and registry keys for Chrome', () => {
        const config = getBrowserConfig(BrowserType.CHROME);

        expect(config.type).toBe(BrowserType.CHROME);
        expect(config.displayName).toBe('Chrome');
        expect(config.userManifestPath).toBe(
          'C:\\Users\\testuser\\AppData\\Roaming\\Google\\Chrome\\NativeMessagingHosts\\com.chromemcp.nativehost.json',
        );
        expect(config.systemManifestPath).toBe(
          'C:\\Program Files\\Google\\Chrome\\NativeMessagingHosts\\com.chromemcp.nativehost.json',
        );
        expect(config.registryKey).toBe(
          'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.chromemcp.nativehost',
        );
        expect(config.systemRegistryKey).toBe(
          'HKLM\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.chromemcp.nativehost',
        );
      });

      test('returns correct paths and registry keys for Chromium', () => {
        const config = getBrowserConfig(BrowserType.CHROMIUM);

        expect(config.type).toBe(BrowserType.CHROMIUM);
        expect(config.displayName).toBe('Chromium');
        expect(config.userManifestPath).toBe(
          'C:\\Users\\testuser\\AppData\\Roaming\\Chromium\\NativeMessagingHosts\\com.chromemcp.nativehost.json',
        );
        expect(config.systemManifestPath).toBe(
          'C:\\Program Files\\Chromium\\NativeMessagingHosts\\com.chromemcp.nativehost.json',
        );
        expect(config.registryKey).toBe(
          'HKCU\\Software\\Chromium\\NativeMessagingHosts\\com.chromemcp.nativehost',
        );
        expect(config.systemRegistryKey).toBe(
          'HKLM\\Software\\Chromium\\NativeMessagingHosts\\com.chromemcp.nativehost',
        );
      });
    });
  });

  describe('detectInstalledBrowsers', () => {
    describe('Linux', () => {
      beforeEach(() => {
        mockedOs.platform.mockReturnValue('linux');
      });

      test('detects Chrome when google-chrome command exists', () => {
        mockedExecSync.mockImplementation((cmd: any) => {
          if (cmd.includes('google-chrome')) {
            return Buffer.from('/usr/bin/google-chrome');
          }
          throw new Error('Command not found');
        });

        const browsers = detectInstalledBrowsers();

        expect(browsers).toContain(BrowserType.CHROME);
      });

      test('detects Chromium when chromium-browser command exists', () => {
        mockedExecSync.mockImplementation((cmd: any) => {
          if (cmd.includes('chromium-browser')) {
            return Buffer.from('/usr/bin/chromium-browser');
          }
          throw new Error('Command not found');
        });

        const browsers = detectInstalledBrowsers();

        expect(browsers).toContain(BrowserType.CHROMIUM);
      });

      test('detects both Chrome and Chromium', () => {
        mockedExecSync.mockImplementation((cmd: any) => {
          if (cmd.includes('google-chrome') || cmd.includes('chromium')) {
            return Buffer.from('/usr/bin/browser');
          }
          throw new Error('Command not found');
        });

        const browsers = detectInstalledBrowsers();

        expect(browsers).toHaveLength(2);
        expect(browsers).toContain(BrowserType.CHROME);
        expect(browsers).toContain(BrowserType.CHROMIUM);
      });

      test('returns empty array when no browsers detected', () => {
        mockedExecSync.mockImplementation(() => {
          throw new Error('Command not found');
        });

        const browsers = detectInstalledBrowsers();

        expect(browsers).toHaveLength(0);
      });
    });

    describe('macOS', () => {
      beforeEach(() => {
        mockedOs.platform.mockReturnValue('darwin');
      });

      test('detects Chrome when app exists', () => {
        mockedFs.existsSync.mockImplementation((path: any) => {
          return path === '/Applications/Google Chrome.app';
        });

        const browsers = detectInstalledBrowsers();

        expect(browsers).toContain(BrowserType.CHROME);
      });

      test('detects Chromium when app exists', () => {
        mockedFs.existsSync.mockImplementation((path: any) => {
          return path === '/Applications/Chromium.app';
        });

        const browsers = detectInstalledBrowsers();

        expect(browsers).toContain(BrowserType.CHROMIUM);
      });

      test('detects both browsers', () => {
        mockedFs.existsSync.mockReturnValue(true);

        const browsers = detectInstalledBrowsers();

        expect(browsers).toHaveLength(2);
        expect(browsers).toContain(BrowserType.CHROME);
        expect(browsers).toContain(BrowserType.CHROMIUM);
      });

      test('returns empty array when no browsers detected', () => {
        mockedFs.existsSync.mockReturnValue(false);

        const browsers = detectInstalledBrowsers();

        expect(browsers).toHaveLength(0);
      });
    });

    describe('Windows', () => {
      beforeEach(() => {
        mockedOs.platform.mockReturnValue('win32');
      });

      test('detects Chrome when registry key exists', () => {
        mockedExecSync.mockImplementation((cmd: any) => {
          if (cmd.includes('Google\\Chrome')) {
            return Buffer.from('HKLM\\SOFTWARE\\Google\\Chrome');
          }
          throw new Error('Registry key not found');
        });

        const browsers = detectInstalledBrowsers();

        expect(browsers).toContain(BrowserType.CHROME);
      });

      test('detects Chromium when registry key exists', () => {
        mockedExecSync.mockImplementation((cmd: any) => {
          if (cmd.includes('Chromium')) {
            return Buffer.from('HKLM\\SOFTWARE\\Chromium');
          }
          throw new Error('Registry key not found');
        });

        const browsers = detectInstalledBrowsers();

        expect(browsers).toContain(BrowserType.CHROMIUM);
      });

      test('detects both browsers', () => {
        mockedExecSync.mockReturnValue(Buffer.from('Registry key found'));

        const browsers = detectInstalledBrowsers();

        expect(browsers).toHaveLength(2);
        expect(browsers).toContain(BrowserType.CHROME);
        expect(browsers).toContain(BrowserType.CHROMIUM);
      });

      test('returns empty array when no browsers detected', () => {
        mockedExecSync.mockImplementation(() => {
          throw new Error('Registry key not found');
        });

        const browsers = detectInstalledBrowsers();

        expect(browsers).toHaveLength(0);
      });
    });
  });

  describe('parseBrowserType', () => {
    test('parses "chrome" correctly', () => {
      expect(parseBrowserType('chrome')).toBe(BrowserType.CHROME);
      expect(parseBrowserType('Chrome')).toBe(BrowserType.CHROME);
      expect(parseBrowserType('CHROME')).toBe(BrowserType.CHROME);
    });

    test('parses "chromium" correctly', () => {
      expect(parseBrowserType('chromium')).toBe(BrowserType.CHROMIUM);
      expect(parseBrowserType('Chromium')).toBe(BrowserType.CHROMIUM);
      expect(parseBrowserType('CHROMIUM')).toBe(BrowserType.CHROMIUM);
    });

    test('returns undefined for invalid browser names', () => {
      expect(parseBrowserType('firefox')).toBeUndefined();
      expect(parseBrowserType('edge')).toBeUndefined();
      expect(parseBrowserType('')).toBeUndefined();
      expect(parseBrowserType('invalid')).toBeUndefined();
    });
  });

  describe('getAllBrowserConfigs', () => {
    beforeEach(() => {
      mockedOs.platform.mockReturnValue('linux');
      mockedOs.homedir.mockReturnValue('/home/testuser');
    });

    test('returns configs for all browsers', () => {
      const configs = getAllBrowserConfigs();

      expect(configs).toHaveLength(2);
      expect(configs[0].type).toBe(BrowserType.CHROME);
      expect(configs[1].type).toBe(BrowserType.CHROMIUM);
    });

    test('all configs have required fields', () => {
      const configs = getAllBrowserConfigs();

      configs.forEach((config) => {
        expect(config).toHaveProperty('type');
        expect(config).toHaveProperty('displayName');
        expect(config).toHaveProperty('userManifestPath');
        expect(config).toHaveProperty('systemManifestPath');
      });
    });
  });
});
