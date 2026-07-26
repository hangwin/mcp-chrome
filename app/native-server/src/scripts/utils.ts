import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { promisify } from 'util';
import {
  COMMAND_NAME,
  DESCRIPTION,
  EXTENSION_ID,
  HOST_NAME,
  LEGACY_EXTENSION_IDS,
} from './constant';
import { BrowserType, getBrowserConfig, detectInstalledBrowsers } from './browser-config';

export const access = promisify(fs.access);
export const mkdir = promisify(fs.mkdir);
export const writeFile = promisify(fs.writeFile);

/**
 * Get the log directory path for wrapper scripts.
 * Uses platform-appropriate user directories to avoid permission issues.
 *
 * - macOS: ~/Library/Logs/chrome-mcp
 * - Windows: %LOCALAPPDATA%/chrome-mcp/logs
 * - Linux: $XDG_STATE_HOME/chrome-mcp/logs or ~/.local/state/chrome-mcp/logs
 */
export function getLogDir(): string {
  const homedir = os.homedir();

  if (os.platform() === 'darwin') {
    return path.join(homedir, 'Library', 'Logs', 'chrome-mcp');
  } else if (os.platform() === 'win32') {
    return path.join(
      process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local'),
      'chrome-mcp',
      'logs',
    );
  } else {
    // Linux: XDG_STATE_HOME or ~/.local/state
    const xdgState = process.env.XDG_STATE_HOME || path.join(homedir, '.local', 'state');
    return path.join(xdgState, 'chrome-mcp', 'logs');
  }
}

/**
 * 打印彩色文本
 */
export function colorText(text: string, color: string): string {
  const colors: Record<string, string> = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
  };

  return colors[color] + text + colors.reset;
}

/**
 * Get user-level manifest file path
 */
export function getUserManifestPath(): string {
  if (os.platform() === 'win32') {
    // Windows: %APPDATA%\Google\Chrome\NativeMessagingHosts\
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`,
    );
  } else if (os.platform() === 'darwin') {
    // macOS: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`,
    );
  } else {
    // Linux: ~/.config/google-chrome/NativeMessagingHosts/
    return path.join(
      os.homedir(),
      '.config',
      'google-chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`,
    );
  }
}

/**
 * Get system-level manifest file path
 */
export function getSystemManifestPath(): string {
  if (os.platform() === 'win32') {
    // Windows: %ProgramFiles%\Google\Chrome\NativeMessagingHosts\
    return path.join(
      process.env.ProgramFiles || 'C:\\Program Files',
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`,
    );
  } else if (os.platform() === 'darwin') {
    // macOS: /Library/Google/Chrome/NativeMessagingHosts/
    return path.join('/Library', 'Google', 'Chrome', 'NativeMessagingHosts', `${HOST_NAME}.json`);
  } else {
    // Linux: /etc/opt/chrome/native-messaging-hosts/
    return path.join('/etc', 'opt', 'chrome', 'native-messaging-hosts', `${HOST_NAME}.json`);
  }
}

/**
 * Get native host startup script file path
 */
export async function getMainPath(): Promise<string> {
  try {
    const packageDistDir = path.join(__dirname, '..');
    const wrapperScriptName = process.platform === 'win32' ? 'run_host.bat' : 'run_host.sh';
    const absoluteWrapperPath = path.resolve(packageDistDir, wrapperScriptName);
    return absoluteWrapperPath;
  } catch (error) {
    console.log(colorText('Cannot find global package path, using current directory', 'yellow'));
    throw error;
  }
}

/**
 * Write Node.js executable path to node_path.txt for run_host scripts.
 * This ensures the native host uses the same Node.js version that was used during installation,
 * avoiding NODE_MODULE_VERSION mismatch errors with native modules like better-sqlite3.
 *
 * @param distDir - The dist directory where node_path.txt should be written
 * @param nodeExecPath - The Node.js executable path to write (defaults to current process.execPath)
 */
export function writeNodePathFile(distDir: string, nodeExecPath = process.execPath): void {
  try {
    const nodePathFile = path.join(distDir, 'node_path.txt');
    fs.mkdirSync(distDir, { recursive: true });

    console.log(colorText(`Writing Node.js path: ${nodeExecPath}`, 'blue'));
    fs.writeFileSync(nodePathFile, nodeExecPath, 'utf8');
    console.log(colorText('✓ Node.js path written for run_host scripts', 'green'));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(colorText(`⚠️ Failed to write Node.js path: ${message}`, 'yellow'));
  }
}

/**
 * 确保关键文件具有执行权限
 */
export async function ensureExecutionPermissions(): Promise<void> {
  try {
    const packageDistDir = path.join(__dirname, '..');

    if (process.platform === 'win32') {
      // Windows 平台处理
      await ensureWindowsFilePermissions(packageDistDir);
      return;
    }

    // Unix/Linux 平台处理
    const filesToCheck = [
      path.join(packageDistDir, 'index.js'),
      path.join(packageDistDir, 'run_host.sh'),
      path.join(packageDistDir, 'cli.js'),
    ];

    for (const filePath of filesToCheck) {
      if (fs.existsSync(filePath)) {
        try {
          fs.chmodSync(filePath, '755');
          console.log(
            colorText(`✓ Set execution permissions for ${path.basename(filePath)}`, 'green'),
          );
        } catch (err: any) {
          console.warn(
            colorText(
              `⚠️ Unable to set execution permissions for ${path.basename(filePath)}: ${err.message}`,
              'yellow',
            ),
          );
        }
      } else {
        console.warn(colorText(`⚠️ File not found: ${filePath}`, 'yellow'));
      }
    }
  } catch (error: any) {
    console.warn(colorText(`⚠️ Error ensuring execution permissions: ${error.message}`, 'yellow'));
  }
}

/**
 * Windows 平台文件权限处理
 */
async function ensureWindowsFilePermissions(packageDistDir: string): Promise<void> {
  const filesToCheck = [
    path.join(packageDistDir, 'index.js'),
    path.join(packageDistDir, 'run_host.bat'),
    path.join(packageDistDir, 'cli.js'),
  ];

  for (const filePath of filesToCheck) {
    if (fs.existsSync(filePath)) {
      try {
        // 检查文件是否为只读，如果是则移除只读属性
        const stats = fs.statSync(filePath);
        if (!(stats.mode & parseInt('200', 8))) {
          // 检查写权限
          // 尝试移除只读属性
          fs.chmodSync(filePath, stats.mode | parseInt('200', 8));
          console.log(
            colorText(`✓ Removed read-only attribute from ${path.basename(filePath)}`, 'green'),
          );
        }

        // 验证文件可读性
        fs.accessSync(filePath, fs.constants.R_OK);
        console.log(
          colorText(`✓ Verified file accessibility for ${path.basename(filePath)}`, 'green'),
        );
      } catch (err: any) {
        console.warn(
          colorText(
            `⚠️ Unable to verify file permissions for ${path.basename(filePath)}: ${err.message}`,
            'yellow',
          ),
        );
      }
    } else {
      console.warn(colorText(`⚠️ File not found: ${filePath}`, 'yellow'));
    }
  }
}

/**
 * Validate a Chrome extension ID before writing it into allowed_origins.
 * Chrome extension IDs are 32 chars using the a-p alphabet.
 */
export function normalizeExtensionId(extensionId?: string): string {
  const id = (extensionId || EXTENSION_ID).trim();
  if (!/^[a-p]{32}$/.test(id)) {
    throw new Error(
      `Invalid Chrome extension ID "${id}". Expected a 32-character Chrome extension id.`,
    );
  }
  return id;
}

/**
 * Normalize one or more Chrome extension IDs for Native Messaging allowed_origins.
 * Accepts comma-separated values so migration builds can allow the old installed
 * extension and the new source-built extension at the same time.
 */
export function normalizeExtensionIds(extensionIds?: string | string[]): string[] {
  const rawIds = Array.isArray(extensionIds)
    ? extensionIds
    : (
        extensionIds ||
        process.env.MCP_CHROME_EXTENSION_ID ||
        [EXTENSION_ID, ...LEGACY_EXTENSION_IDS].join(',')
      ).split(',');
  const ids = rawIds.map((id) => normalizeExtensionId(id.trim()));
  return Array.from(new Set(ids));
}

function extensionIdsFromManifest(manifestPath: string): string[] {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const origins = Array.isArray(manifest.allowed_origins) ? manifest.allowed_origins : [];
    return origins
      .map((origin: unknown) =>
        typeof origin === 'string' ? origin.match(/^chrome-extension:\/\/([a-p]{32})\/$/)?.[1] : '',
      )
      .filter((id: string | undefined): id is string => Boolean(id));
  } catch {
    return [];
  }
}

function getBrowserUserDataDir(browserType: BrowserType): string | null {
  const home = os.homedir();
  if (os.platform() === 'darwin') {
    return browserType === BrowserType.CHROMIUM
      ? path.join(home, 'Library', 'Application Support', 'Chromium')
      : path.join(home, 'Library', 'Application Support', 'Google', 'Chrome');
  }
  if (os.platform() === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return browserType === BrowserType.CHROMIUM
      ? path.join(localAppData, 'Chromium', 'User Data')
      : path.join(localAppData, 'Google', 'Chrome', 'User Data');
  }
  return browserType === BrowserType.CHROMIUM
    ? path.join(home, '.config', 'chromium')
    : path.join(home, '.config', 'google-chrome');
}

function profileDirs(userDataDir: string): string[] {
  try {
    return fs
      .readdirSync(userDataDir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() && (entry.name === 'Default' || /^Profile \d+$/.test(entry.name)),
      )
      .map((entry) => path.join(userDataDir, entry.name));
  } catch {
    return [];
  }
}

function maybeChromeMcpManifest(manifest: any): boolean {
  const text = JSON.stringify({
    name: manifest?.name,
    default_locale: manifest?.default_locale,
    description: manifest?.description,
    permissions: manifest?.permissions,
  }).toLowerCase();
  return (
    (text.includes('chrome mcp') ||
      text.includes('chrome-mcp') ||
      text.includes('mcp chrome') ||
      text.includes('__msg_extensionname__')) &&
    text.includes('nativemessaging')
  );
}

function detectProfileExtensionIds(browserType: BrowserType): string[] {
  const userDataDir = getBrowserUserDataDir(browserType);
  if (!userDataDir) return [];

  const ids = new Set<string>();

  for (const profileDir of profileDirs(userDataDir)) {
    const settingsPath = path.join(profileDir, 'Preferences');
    try {
      const prefs = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const settings = prefs.extensions?.settings || {};
      for (const [id, setting] of Object.entries<any>(settings)) {
        const manifest = setting?.manifest;
        if (/^[a-p]{32}$/.test(id) && manifest && maybeChromeMcpManifest(manifest)) {
          ids.add(id);
        }
      }
    } catch {
      // Chrome profile files may be locked or privacy-protected. Packed extension
      // directories below still cover common installed-extension cases.
    }

    const extensionsDir = path.join(profileDir, 'Extensions');
    try {
      for (const id of fs.readdirSync(extensionsDir)) {
        if (!/^[a-p]{32}$/.test(id)) continue;
        const versionRoot = path.join(extensionsDir, id);
        const versions = fs.existsSync(versionRoot) ? fs.readdirSync(versionRoot) : [];
        for (const version of versions) {
          const manifestPath = path.join(versionRoot, version, 'manifest.json');
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            if (maybeChromeMcpManifest(manifest)) ids.add(id);
          } catch {
            // Ignore unreadable extension manifests.
          }
        }
      }
    } catch {
      // Ignore missing extension directories.
    }
  }

  return Array.from(ids);
}

function collectAllowedExtensionIds(
  browserType: BrowserType,
  manifestPath: string,
  extensionId?: string | string[],
): string[] {
  return normalizeExtensionIds([
    ...normalizeExtensionIds(extensionId),
    ...extensionIdsFromManifest(manifestPath),
    ...detectProfileExtensionIds(browserType),
  ]);
}

/**
 * Create Native Messaging host manifest content
 */
export async function createManifestContent(extensionId?: string | string[]): Promise<any> {
  const mainPath = await getMainPath();
  const allowedExtensionIds = normalizeExtensionIds(extensionId);

  return {
    name: HOST_NAME,
    description: DESCRIPTION,
    path: mainPath, // Node.js可执行文件路径
    type: 'stdio',
    allowed_origins: allowedExtensionIds.map((id) => `chrome-extension://${id}/`),
  };
}

/**
 * 验证Windows注册表项是否存在且指向正确路径
 */
function verifyWindowsRegistryEntry(registryKey: string, expectedPath: string): boolean {
  if (os.platform() !== 'win32') {
    return true; // 非Windows平台跳过验证
  }

  const normalizeForCompare = (filePath: string): string => path.normalize(filePath).toLowerCase();

  try {
    const output = execSync(`reg query "${registryKey}" /ve`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const lines = output
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const match = line.match(/REG_SZ\s+(.*)$/i);
      if (!match?.[1]) continue;
      const actualPath = match[1].trim();
      return normalizeForCompare(actualPath) === normalizeForCompare(expectedPath);
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Write node_path.txt and then register user-level Native Messaging host.
 * This is the recommended entry point for development and production registration,
 * as it ensures the Node.js path is captured before registration.
 *
 * @param browsers - Optional list of browsers to register for
 * @returns true if at least one browser was registered successfully
 */
export async function registerUserLevelHostWithNodePath(
  browsers?: BrowserType[],
  extensionId?: string | string[],
): Promise<boolean> {
  writeNodePathFile(path.join(__dirname, '..'));
  return tryRegisterUserLevelHost(browsers, extensionId);
}

/**
 * 尝试注册用户级别的Native Messaging主机
 */
export async function tryRegisterUserLevelHost(
  targetBrowsers?: BrowserType[],
  extensionId?: string | string[],
): Promise<boolean> {
  try {
    console.log(colorText('Attempting to register user-level Native Messaging host...', 'blue'));

    // 1. 确保执行权限
    await ensureExecutionPermissions();

    // 2. 确定要注册的浏览器
    const browsersToRegister = targetBrowsers || detectInstalledBrowsers();
    if (browsersToRegister.length === 0) {
      // 如果没有检测到浏览器，默认注册Chrome和Chromium
      browsersToRegister.push(BrowserType.CHROME, BrowserType.CHROMIUM);
      console.log(
        colorText('No browsers detected, registering for Chrome and Chromium by default', 'yellow'),
      );
    } else {
      console.log(colorText(`Detected browsers: ${browsersToRegister.join(', ')}`, 'blue'));
    }

    let successCount = 0;
    const results: { browser: string; success: boolean; error?: string }[] = [];

    // 3. 为每个浏览器注册
    for (const browserType of browsersToRegister) {
      const config = getBrowserConfig(browserType);
      console.log(colorText(`\nRegistering for ${config.displayName}...`, 'blue'));

      try {
        const allowedExtensionIds = collectAllowedExtensionIds(
          browserType,
          config.userManifestPath,
          extensionId,
        );
        const manifest = await createManifestContent(allowedExtensionIds);

        // 确保目录存在
        await mkdir(path.dirname(config.userManifestPath), { recursive: true });

        // 写入清单文件
        await writeFile(config.userManifestPath, JSON.stringify(manifest, null, 2));
        console.log(colorText(`✓ Manifest written to ${config.userManifestPath}`, 'green'));

        // Windows需要额外注册表项
        if (os.platform() === 'win32' && config.registryKey) {
          try {
            // 注意：不需要手动双写反斜杠，reg 命令会正确处理 Windows 路径
            const regCommand = `reg add "${config.registryKey}" /ve /t REG_SZ /d "${config.userManifestPath}" /f`;
            execSync(regCommand, { stdio: 'pipe' });

            if (verifyWindowsRegistryEntry(config.registryKey, config.userManifestPath)) {
              console.log(colorText(`✓ Registry entry created for ${config.displayName}`, 'green'));
            } else {
              throw new Error('Registry verification failed');
            }
          } catch (error: any) {
            throw new Error(`Registry error: ${error.message}`);
          }
        }

        successCount++;
        results.push({ browser: config.displayName, success: true });
        console.log(colorText(`✓ Successfully registered ${config.displayName}`, 'green'));
      } catch (error: any) {
        results.push({ browser: config.displayName, success: false, error: error.message });
        console.log(
          colorText(`✗ Failed to register ${config.displayName}: ${error.message}`, 'red'),
        );
      }
    }

    // 4. 报告结果
    console.log(colorText('\n===== Registration Summary =====', 'blue'));
    for (const result of results) {
      if (result.success) {
        console.log(colorText(`✓ ${result.browser}: Success`, 'green'));
      } else {
        console.log(colorText(`✗ ${result.browser}: Failed - ${result.error}`, 'red'));
      }
    }

    return successCount > 0;
  } catch (error) {
    console.log(
      colorText(
        `User-level registration failed: ${error instanceof Error ? error.message : String(error)}`,
        'yellow',
      ),
    );
    return false;
  }
}

// 导入is-admin包（仅在Windows平台使用）
let isAdmin: () => boolean = () => false;
if (process.platform === 'win32') {
  try {
    isAdmin = require('is-admin');
  } catch (error) {
    console.warn('缺少is-admin依赖，Windows平台下可能无法正确检测管理员权限');
    console.warn(error);
  }
}

/**
 * 使用提升权限注册系统级清单
 */
export async function registerWithElevatedPermissions(
  extensionId?: string | string[],
): Promise<void> {
  try {
    console.log(colorText('Attempting to register system-level manifest...', 'blue'));

    // 1. 确保执行权限
    await ensureExecutionPermissions();

    // 2. 获取系统级清单路径
    const manifestPath = getSystemManifestPath();

    // 3. 准备清单内容
    const manifest = await createManifestContent([
      ...normalizeExtensionIds(extensionId),
      ...extensionIdsFromManifest(manifestPath),
    ]);

    // 4. 创建临时清单文件
    const tempManifestPath = path.join(os.tmpdir(), `${HOST_NAME}.json`);
    await writeFile(tempManifestPath, JSON.stringify(manifest, null, 2));

    // 5. 检测是否已经有管理员权限
    const isRoot = process.getuid && process.getuid() === 0; // Unix/Linux/Mac
    const hasAdminRights = process.platform === 'win32' ? isAdmin() : false; // Windows平台检测管理员权限
    const hasElevatedPermissions = isRoot || hasAdminRights;

    // 准备命令
    const command =
      os.platform() === 'win32'
        ? `if not exist "${path.dirname(manifestPath)}" mkdir "${path.dirname(manifestPath)}" && copy "${tempManifestPath}" "${manifestPath}"`
        : `mkdir -p "${path.dirname(manifestPath)}" && cp "${tempManifestPath}" "${manifestPath}" && chmod 644 "${manifestPath}"`;

    if (hasElevatedPermissions) {
      // 已经有管理员权限，直接执行命令
      try {
        // 创建目录
        if (!fs.existsSync(path.dirname(manifestPath))) {
          fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
        }

        // 复制文件
        fs.copyFileSync(tempManifestPath, manifestPath);

        // 设置权限（非Windows平台）
        if (os.platform() !== 'win32') {
          fs.chmodSync(manifestPath, '644');
        }

        console.log(colorText('System-level manifest registration successful!', 'green'));
      } catch (error: any) {
        console.error(
          colorText(`System-level manifest installation failed: ${error.message}`, 'red'),
        );
        throw error;
      }
    } else {
      // 没有管理员权限，打印手动操作提示
      console.log(
        colorText('⚠️ Administrator privileges required for system-level installation', 'yellow'),
      );
      console.log(
        colorText(
          'Please run one of the following commands with administrator privileges:',
          'blue',
        ),
      );

      if (os.platform() === 'win32') {
        console.log(colorText('  1. Open Command Prompt as Administrator and run:', 'blue'));
        console.log(colorText(`     ${command}`, 'cyan'));
      } else {
        console.log(colorText('  1. Run with sudo:', 'blue'));
        console.log(colorText(`     sudo ${command}`, 'cyan'));
      }

      console.log(
        colorText('  2. Or run the registration command with elevated privileges:', 'blue'),
      );
      console.log(colorText(`     sudo ${COMMAND_NAME} register --system`, 'cyan'));

      throw new Error('Administrator privileges required for system-level installation');
    }

    // 6. Windows特殊处理 - 设置系统级注册表
    if (os.platform() === 'win32') {
      const registryKey = `HKLM\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;
      // 注意：不需要手动双写反斜杠，reg 命令会正确处理 Windows 路径
      const regCommand = `reg add "${registryKey}" /ve /t REG_SZ /d "${manifestPath}" /f`;

      console.log(colorText(`Creating system registry entry: ${registryKey}`, 'blue'));
      console.log(colorText(`Manifest path: ${manifestPath}`, 'blue'));

      if (hasElevatedPermissions) {
        // 已经有管理员权限，直接执行注册表命令
        try {
          execSync(regCommand, { stdio: 'pipe' });

          // 验证注册表项是否创建成功
          if (verifyWindowsRegistryEntry(registryKey, manifestPath)) {
            console.log(colorText('Windows registry entry created successfully!', 'green'));
          } else {
            console.log(colorText('⚠️ Registry entry created but verification failed', 'yellow'));
          }
        } catch (error: any) {
          console.error(
            colorText(`Windows registry entry creation failed: ${error.message}`, 'red'),
          );
          console.error(colorText(`Command: ${regCommand}`, 'red'));
          throw error;
        }
      } else {
        // 没有管理员权限，打印手动操作提示
        console.log(
          colorText(
            '⚠️ Administrator privileges required for Windows registry modification',
            'yellow',
          ),
        );
        console.log(colorText('Please run the following command as Administrator:', 'blue'));
        console.log(colorText(`  ${regCommand}`, 'cyan'));
        console.log(colorText('Or run the registration command with elevated privileges:', 'blue'));
        console.log(
          colorText(
            `  Run Command Prompt as Administrator and execute: ${COMMAND_NAME} register --system`,
            'cyan',
          ),
        );

        throw new Error('Administrator privileges required for Windows registry modification');
      }
    }
  } catch (error: any) {
    console.error(colorText(`注册失败: ${error.message}`, 'red'));
    throw error;
  }
}
