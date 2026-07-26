<script setup lang="ts">
import { ref } from 'vue';
import { LINKS, NATIVE_HOST } from '@/common/constants';

import '../sidepanel/styles/agent-chat.css';

const COMMANDS = {
  npmInstall: 'npm install -g agent-chrome-mcp',
  pnpmInstall: 'pnpm add -g agent-chrome-mcp',
  yarnInstall: 'yarn global add agent-chrome-mcp',
  mcpUrl: 'http://127.0.0.1:' + NATIVE_HOST.DEFAULT_PORT + '/mcp',
  doctor: 'agent-chrome-mcp doctor',
  fix: 'agent-chrome-mcp doctor --fix',
  report: 'agent-chrome-mcp report --copy',
} as const;

type CommandKey = keyof typeof COMMANDS;

const copiedKey = ref<CommandKey | null>(null);

const ALT_INSTALL = [
  { label: 'pnpm', key: 'pnpmInstall' },
  { label: 'yarn', key: 'yarnInstall' },
] as const satisfies ReadonlyArray<{ label: string; key: CommandKey }>;

const DIAGNOSTICS = [
  { label: 'Doctor', key: 'doctor' },
  { label: 'Auto-fix', key: 'fix' },
] as const satisfies ReadonlyArray<{ label: string; key: CommandKey }>;

function copyLabel(key: CommandKey): string {
  return copiedKey.value === key ? 'Copied' : 'Copy';
}

function copyColor(key: CommandKey): string {
  return copiedKey.value === key ? 'var(--ac-success)' : 'var(--ac-text-muted)';
}

async function copyCommand(key: CommandKey): Promise<void> {
  try {
    await navigator.clipboard.writeText(COMMANDS[key]);
    copiedKey.value = key;
    window.setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    copiedKey.value = null;
  }
}

async function openDocs(): Promise<void> {
  try {
    await chrome.tabs.create({ url: LINKS.TROUBLESHOOTING });
  } catch {
    window.open(LINKS.TROUBLESHOOTING, '_blank', 'noopener,noreferrer');
  }
}
</script>

<template>
  <div class="agent-theme welcome-root">
    <div class="min-h-screen flex flex-col">
      <header class="welcome-header flex-none px-6 py-5">
        <div class="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="welcome-icon w-10 h-10 flex items-center justify-center flex-shrink-0"
              aria-hidden="true"
            >
              <svg
                class="w-6 h-6"
                :style="{ color: 'var(--ac-accent)' }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div class="min-w-0">
              <h1 class="welcome-title text-lg font-medium tracking-tight truncate">
                Chrome MCP
              </h1>
              <p class="welcome-muted text-sm truncate">
                After the extension is installed, this is the only required step.
              </p>
            </div>
          </div>

          <button
            class="welcome-button px-3 py-2 text-xs font-medium ac-btn flex-shrink-0"
            @click="openDocs"
          >
            Troubleshooting Docs
          </button>
        </div>
      </header>

      <main class="flex-1 px-6 py-8">
        <div class="max-w-3xl mx-auto space-y-6">
          <section class="welcome-card welcome-card--primary p-6">
            <h2 class="welcome-title text-xl font-medium">
              Install <code class="welcome-code">agent-chrome-mcp</code>
            </h2>
            <p class="welcome-muted text-sm mt-2">
              The Chrome extension uses this local bridge to expose MCP tools to your client.
            </p>

            <div class="mt-4 space-y-3">
              <div class="welcome-command-row flex items-center justify-between gap-3 px-4 py-3">
                <code class="welcome-code text-sm break-all">{{ COMMANDS.npmInstall }}</code>
                <button
                  class="welcome-mono px-2 py-1 text-xs font-medium ac-btn flex-shrink-0"
                  :style="{ color: copyColor('npmInstall') }"
                  @click="copyCommand('npmInstall')"
                >
                  {{ copyLabel('npmInstall') }}
                </button>
              </div>

              <div class="grid sm:grid-cols-2 gap-3">
                <div
                  v-for="item in ALT_INSTALL"
                  :key="item.key"
                  class="welcome-alt-row flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div class="min-w-0">
                    <div
                      class="welcome-mono welcome-subtle text-[10px] uppercase tracking-widest font-medium"
                    >
                      {{ item.label }}
                    </div>
                    <code class="welcome-code text-xs break-all">{{ COMMANDS[item.key] }}</code>
                  </div>
                  <button
                    class="welcome-mono px-2 py-1 text-xs font-medium ac-btn flex-shrink-0"
                    :style="{ color: copyColor(item.key) }"
                    @click="copyCommand(item.key)"
                  >
                    {{ copyLabel(item.key) }}
                  </button>
                </div>
              </div>

              <div class="welcome-alt-row welcome-muted px-4 py-3 text-xs">
                Requires Node.js 20+. Check your version with
                <code class="welcome-code welcome-code-inline px-1 py-0.5">node -v</code>.
              </div>
            </div>

            <div
              class="mt-6 pt-5"
              :style="{ borderTop: 'var(--ac-border-width) solid var(--ac-border)' }"
            >
              <h3 class="welcome-title text-sm font-medium">MCP client URL (streamable HTTP)</h3>
              <p class="welcome-muted text-sm mt-1">
                Use this URL in your MCP client (e.g., Claude Desktop, CherryStudio).
              </p>

              <div
                class="welcome-command-row mt-3 flex items-center justify-between gap-3 px-4 py-3"
              >
                <code class="welcome-code text-sm break-all">{{ COMMANDS.mcpUrl }}</code>
                <button
                  class="welcome-mono px-2 py-1 text-xs font-medium ac-btn flex-shrink-0"
                  :style="{ color: copyColor('mcpUrl') }"
                  @click="copyCommand('mcpUrl')"
                >
                  {{ copyLabel('mcpUrl') }}
                </button>
              </div>

              <p class="welcome-subtle text-xs mt-3">
                Tip: You can also open the extension popup and click "Connect" to copy a full client
                config snippet.
              </p>
            </div>
          </section>

          <details class="welcome-card overflow-hidden">
            <summary
              class="px-6 py-4 cursor-pointer select-none flex items-center justify-between gap-4"
            >
              <div class="min-w-0">
                <div class="welcome-title text-sm font-medium">Troubleshooting</div>
                <div class="welcome-muted text-xs truncate">
                  Use these only if the bridge fails to register or connect.
                </div>
              </div>
              <span class="welcome-mono welcome-subtle text-xs flex-shrink-0">doctor · report</span>
            </summary>

            <div class="px-6 pb-6 space-y-4">
              <div class="welcome-alt-row p-4">
                <div class="text-sm font-medium">Diagnostics</div>
                <p class="welcome-muted text-sm mt-1">
                  Run <code class="welcome-code">doctor</code> to check installation status. If it
                  reports an error, run the auto-fix command.
                </p>

                <div class="mt-3 space-y-2">
                  <div
                    v-for="item in DIAGNOSTICS"
                    :key="item.key"
                    class="welcome-command-row flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div class="min-w-0">
                      <div
                        class="welcome-mono welcome-subtle text-[10px] uppercase tracking-widest font-medium"
                      >
                        {{ item.label }}
                      </div>
                      <code class="welcome-code text-xs break-all">{{ COMMANDS[item.key] }}</code>
                    </div>
                    <button
                      class="welcome-mono px-2 py-1 text-xs font-medium ac-btn flex-shrink-0"
                      :style="{ color: copyColor(item.key) }"
                      @click="copyCommand(item.key)"
                    >
                      {{ copyLabel(item.key) }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="welcome-report-card p-4">
                <div class="text-sm font-medium" :style="{ color: 'var(--ac-danger)' }">
                  Report an issue
                </div>
                <p class="welcome-muted text-sm mt-1">
                  Generate a diagnostic report and paste it into a GitHub issue.
                </p>

                <div
                  class="welcome-command-row mt-3 flex items-center justify-between gap-3 px-3 py-2"
                >
                  <code class="welcome-code text-xs break-all">{{ COMMANDS.report }}</code>
                  <button
                    class="welcome-mono px-2 py-1 text-xs font-medium ac-btn flex-shrink-0"
                    :style="{ color: copyColor('report') }"
                    @click="copyCommand('report')"
                  >
                    {{ copyLabel('report') }}
                  </button>
                </div>

                <p class="welcome-subtle text-xs mt-2">
                  This copies the report to your clipboard (sensitive info is automatically
                  redacted).
                </p>
              </div>

              <div class="flex">
                <button
                  class="welcome-button px-3 py-2 text-xs font-medium ac-btn"
                  @click="openDocs"
                >
                  Open troubleshooting docs
                </button>
              </div>
            </div>
          </details>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.welcome-root {
  min-height: 100%;
  background: var(--ac-bg);
  background-image: var(--ac-bg-pattern);
  background-size: var(--ac-bg-pattern-size);
  color: var(--ac-text);
  font-family: var(--ac-font-body);
}

.welcome-header {
  background: var(--ac-header-bg);
  border-bottom: var(--ac-border-width) solid var(--ac-header-border);
  backdrop-filter: blur(8px);
}

.welcome-card {
  background: var(--ac-surface);
  border: var(--ac-border-width) solid var(--ac-border);
  border-radius: var(--ac-radius-card);
  box-shadow: var(--ac-shadow-card);
}

.welcome-card--primary {
  box-shadow: var(--ac-shadow-float);
}

.welcome-icon {
  background: var(--ac-surface);
  border: var(--ac-border-width) solid var(--ac-border);
  border-radius: var(--ac-radius-card);
  box-shadow: var(--ac-shadow-card);
}

.welcome-title {
  font-family: var(--ac-font-heading);
  color: var(--ac-text);
}

.welcome-muted {
  color: var(--ac-text-muted);
}

.welcome-subtle {
  color: var(--ac-text-subtle);
}

.welcome-mono {
  font-family: var(--ac-font-mono);
}

.welcome-code {
  font-family: var(--ac-font-code);
}

.welcome-button {
  font-family: var(--ac-font-mono);
  color: var(--ac-text-muted);
  background: var(--ac-surface);
  border: var(--ac-border-width) solid var(--ac-border);
  border-radius: var(--ac-radius-button);
  cursor: pointer;
  transition: all 0.2s ease;
}

.welcome-button:hover {
  background: var(--ac-hover-bg-subtle);
}

.welcome-command-row {
  background: var(--ac-code-bg);
  border: var(--ac-border-width) solid var(--ac-code-border);
  border-radius: var(--ac-radius-inner);
}

.welcome-alt-row {
  background: var(--ac-surface-muted);
  border: var(--ac-border-width) solid var(--ac-border);
  border-radius: var(--ac-radius-inner);
}

.welcome-report-card {
  background: var(--ac-diff-del-bg);
  border: var(--ac-border-width) solid var(--ac-diff-del-border);
  border-radius: var(--ac-radius-inner);
}

.welcome-code-inline {
  background: var(--ac-hover-bg-subtle);
  border: var(--ac-border-width) solid var(--ac-border);
  border-radius: 6px;
}

.ac-btn {
  cursor: pointer;
  transition: all 0.2s ease;
}

.ac-btn:hover {
  opacity: 0.8;
}

summary {
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}
</style>
