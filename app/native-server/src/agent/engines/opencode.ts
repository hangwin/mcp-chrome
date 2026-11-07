import { spawn } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AgentEngine, EngineExecutionContext, EngineInitOptions } from './types';
import type { AgentMessage } from '../types';

/**
 * OpenCodeEngine integrates the `opencode` CLI (https://opencode.ai) as an
 * AgentEngine implementation.
 *
 * Unlike the Claude/Codex engines, OpenCode owns its own provider, auth and MCP
 * configuration (via the user's opencode config). This engine is therefore a thin
 * adapter: it spawns `opencode run --format json` and translates OpenCode's
 * newline-delimited JSON event stream into the RealtimeEvent envelopes the
 * sidepanel UI consumes. Because OpenCode resolves its own model/provider, the
 * engine works with any provider the user has configured (OpenAI-compatible,
 * Anthropic, local, etc.) and inherits any MCP servers from the opencode config.
 *
 * Event mapping (opencode `--format json`):
 *   - type "text"        -> assistant message (streamed, keyed by part id)
 *   - type "tool_use"    -> tool_use / tool_result messages (part.state.status)
 *   - type "reasoning"   -> folded into assistant content when present
 *   - type "step_finish" -> flush assistant buffer
 */
export class OpenCodeEngine implements AgentEngine {
  public readonly name = 'opencode' as const;
  // OpenCode manages its own MCP servers via the user's opencode config,
  // so the native server does not inject the Chrome MCP bridge here.
  public readonly supportsMcp = false;

  private static readonly MAX_STDERR_LINES = 200;

  async initializeAndRun(options: EngineInitOptions, ctx: EngineExecutionContext): Promise<void> {
    const {
      sessionId,
      instruction,
      model,
      projectRoot,
      requestId,
      signal,
      resolvedImagePaths,
    } = options;

    const executable = process.env.OPENCODE_BIN?.trim() || 'opencode';
    const args: string[] = ['run', '--format', 'json', '--auto'];

    // OpenCode model format is "provider/model[#variant]". When no model is
    // provided (or the sentinel "default"), OpenCode uses the default model
    // from the user's config.
    const trimmedModel = model?.trim();
    if (trimmedModel && trimmedModel !== 'default') {
      args.push('--model', trimmedModel);
    }

    // Attach resolved image/file paths, if any.
    for (const filePath of resolvedImagePaths ?? []) {
      if (filePath) args.push('--file', filePath);
    }

    // The instruction is passed as the positional message.
    args.push(instruction);

    const cwd = (projectRoot && projectRoot.trim()) || process.env.MCP_AGENT_PROJECT_ROOT || process.cwd();

    const child = spawn(executable, args, {
      cwd,
      env: this.buildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // ---- cancellation ----
    const onAbort = (): void => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* noop */
      }
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    // ---- assistant text accumulation (keyed by part id, preserves order) ----
    const textParts = new Map<string, string>();
    const reasoningParts = new Map<string, string>();
    let assistantMessageId: string | null = null;
    let assistantCreatedAt: string | null = null;
    const emittedToolStages = new Set<string>();

    const buildAssistantContent = (): string => {
      const reasoning = Array.from(reasoningParts.values()).join('').trim();
      const text = Array.from(textParts.values()).join('').trim();
      return [reasoning, text].filter(Boolean).join('\n\n').trim();
    };

    const emitAssistant = (isFinal: boolean): void => {
      const content = buildAssistantContent();
      if (!content) return;
      if (!assistantMessageId) assistantMessageId = randomUUID();
      if (!assistantCreatedAt) assistantCreatedAt = new Date().toISOString();

      const message: AgentMessage = {
        id: assistantMessageId,
        sessionId,
        role: 'assistant',
        content,
        messageType: 'chat',
        cliSource: this.name,
        requestId,
        isStreaming: !isFinal,
        isFinal,
        createdAt: assistantCreatedAt,
      };
      ctx.emit({ type: 'message', data: message });
    };

    const emitTool = (
      content: string,
      messageType: 'tool_use' | 'tool_result',
      isStreaming: boolean,
      metadata: Record<string, unknown>,
    ): void => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const message: AgentMessage = {
        id: randomUUID(),
        sessionId,
        role: 'tool',
        content: trimmed,
        messageType,
        cliSource: this.name,
        requestId,
        isStreaming,
        isFinal: !isStreaming,
        createdAt: new Date().toISOString(),
        metadata: { cli_type: 'opencode', ...metadata },
      };
      ctx.emit({ type: 'message', data: message });
    };

    const stringifyMaybe = (value: unknown): string => {
      if (value == null) return '';
      if (typeof value === 'string') return value;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };

    const handleToolEvent = (part: Record<string, any>): void => {
      const state = (part.state as Record<string, any>) || {};
      const status = state.status as string | undefined;
      const toolName = (part.tool as string) || 'tool';
      const key = (part.id as string) || (part.partID as string) || randomUUID();

      if (status === 'completed' || status === 'error') {
        const stage = `${key}:done`;
        if (emittedToolStages.has(stage)) return;
        emittedToolStages.add(stage);
        const inputStr = state.input ? stringifyMaybe(state.input) : '';
        const output =
          status === 'error'
            ? stringifyMaybe(state.error ?? state.output ?? 'Tool failed')
            : stringifyMaybe(state.output);
        const header = inputStr ? `${toolName}(${inputStr})` : toolName;
        emitTool(output ? `${header}\n${output}` : header, 'tool_result', false, {
          toolName,
          tool_name: toolName,
          input: state.input,
          status,
        });
      } else {
        const stage = `${key}:use`;
        if (emittedToolStages.has(stage)) return;
        emittedToolStages.add(stage);
        const inputStr = state.input ? stringifyMaybe(state.input) : '';
        emitTool(inputStr ? `Running ${toolName}: ${inputStr}` : `Running ${toolName}`, 'tool_use', true, {
          toolName,
          tool_name: toolName,
          input: state.input,
          status: status ?? 'running',
        });
      }
    };

    // ---- stderr capture (bounded) ----
    const stderrLines: string[] = [];
    if (child.stderr) {
      const errRl = readline.createInterface({ input: child.stderr });
      errRl.on('line', (line) => {
        stderrLines.push(line);
        if (stderrLines.length > OpenCodeEngine.MAX_STDERR_LINES) {
          stderrLines.splice(0, stderrLines.length - OpenCodeEngine.MAX_STDERR_LINES);
        }
      });
    }

    // ---- stdout: newline-delimited JSON events ----
    const rl = readline.createInterface({ input: child.stdout! });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let evt: Record<string, any>;
      try {
        evt = JSON.parse(trimmed);
      } catch {
        return; // ignore non-JSON log noise
      }
      const type = evt.type as string | undefined;
      const part = (evt.part as Record<string, any>) || {};

      switch (type) {
        case 'text': {
          if (typeof part.text === 'string') {
            const id = (part.id as string) || 'text';
            textParts.set(id, part.text);
            emitAssistant(false);
          }
          break;
        }
        case 'reasoning': {
          if (typeof part.text === 'string') {
            const id = (part.id as string) || 'reasoning';
            reasoningParts.set(id, part.text);
            emitAssistant(false);
          }
          break;
        }
        case 'tool_use':
        case 'tool': {
          handleToolEvent(part);
          break;
        }
        case 'step_finish':
        case 'step-finish': {
          emitAssistant(false);
          break;
        }
        case 'error': {
          const msg = stringifyMaybe(evt.error ?? part.error ?? 'OpenCode error');
          if (msg) emitTool(msg, 'tool_result', false, { toolName: 'error', status: 'error' });
          break;
        }
        default:
          break;
      }
    });

    await new Promise<void>((resolve, reject) => {
      child.on('error', (err: Error) => {
        reject(new Error(`Failed to start opencode (${executable}): ${err.message}`));
      });
      child.on('close', (code) => {
        if (signal?.aborted) {
          resolve();
          return;
        }
        // Final flush of any accumulated assistant text.
        emitAssistant(true);
        if (code && code !== 0) {
          const errText = stderrLines.join('\n').trim();
          reject(
            new Error(
              errText
                ? `opencode exited with code ${code}: ${errText}`
                : `opencode exited with code ${code}`,
            ),
          );
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Build the child-process environment, ensuring the opencode binary is
   * discoverable even when the native host runs with a reduced PATH.
   */
  private buildEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    const extraPaths = [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      path.join(process.env.HOME || '', '.local/bin'),
    ].filter(Boolean);
    const currentPath = env.PATH || env.Path || '';
    env.PATH = [...extraPaths, currentPath].filter(Boolean).join(path.delimiter);
    return env;
  }
}
