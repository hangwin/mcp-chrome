import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { AgentEngine, EngineExecutionContext, EngineName, EngineInitOptions } from './types';
import type { RealtimeEvent, AgentMessage } from '../types';
import { randomUUID } from 'node:crypto';

/**
 * QwenEngine integrates the Qwen Code CLI as an AgentEngine implementation.
 *
 * Uses `qwen -y -p "<instruction>"` for non-interactive agent mode.
 */
export class QwenEngine extends EventEmitter implements AgentEngine {
  readonly name: EngineName = 'qwen';
  private abortController: AbortController | null = null;

  async initializeAndRun(options: EngineInitOptions, ctx: EngineExecutionContext): Promise<void> {
    const trimmed = options.instruction.trim();
    if (!trimmed) {
      throw new Error('QwenEngine: instruction must not be empty');
    }

    if (options.signal?.aborted) {
      throw new Error('QwenEngine: execution was cancelled');
    }

    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const repoPath = options.projectRoot || process.cwd();
    const resolvedModel = options.model || '';

    console.error(`[QwenEngine] Starting query with model: ${resolvedModel || 'default'}`);
    console.error(`[QwenEngine] Working directory: ${repoPath}`);

    // Build command arguments
    const args: string[] = ['-y']; // YOLO mode - auto-approve all actions

    if (resolvedModel) {
      args.push('-m', resolvedModel);
    }

    args.push('-p', trimmed);

    // Ensure project directory exists
    await mkdir(repoPath, { recursive: true });

    return new Promise<void>((resolve, reject) => {
      const qwen = spawn('qwen', args, {
        cwd: repoPath,
        env: { ...process.env },
        signal: signal as any,
      });

      let stdoutBuffer = '';
      const stderrBuffer: string[] = [];
      const MAX_STDERR_LINES = 100;

      // Handle stdout - parse for events
      stdoutBuffer = '';
      qwen.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdoutBuffer += text;

        // Try to parse events from output
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          // Detect tool calls
          if (trimmedLine.includes('Calling tool') || trimmedLine.includes('Running')) {
            const toolName = extractToolName(trimmedLine);
            ctx.emit({
              type: 'status',
              data: {
                sessionId: options.sessionId,
                status: 'running',
                message: `Using tool: ${toolName}`,
                requestId: options.requestId,
              },
            });
          }

          // Detect thinking/processing - emit as assistant message
          if (trimmedLine.startsWith('Qwen') || trimmedLine.includes('Thinking')) {
            const message: AgentMessage = {
              id: randomUUID(),
              sessionId: options.sessionId,
              role: 'assistant',
              content: trimmedLine,
              messageType: 'chat',
              createdAt: new Date().toISOString(),
            };
            ctx.emit({
              type: 'message',
              data: message,
            });
          }
        }
      });

      // Handle stderr - log and emit as status
      qwen.stderr.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (!line) return;

        stderrBuffer.push(line);
        if (stderrBuffer.length > MAX_STDERR_LINES) {
          stderrBuffer.splice(0, stderrBuffer.length - MAX_STDERR_LINES);
        }

        console.error(`[QwenEngine][stderr] ${line}`);

        // Emit as status for visibility
        ctx.emit({
          type: 'status',
          data: {
            sessionId: options.sessionId,
            status: 'running',
            message: line,
            requestId: options.requestId,
          },
        });
      });

      // Handle process exit
      qwen.on('close', (code) => {
        console.error(`[QwenEngine] Process exited with code ${code}`);

        if (code === 0) {
          // Emit final output as assistant message
          if (stdoutBuffer.trim()) {
            const message: AgentMessage = {
              id: randomUUID(),
              sessionId: options.sessionId,
              role: 'assistant',
              content: stdoutBuffer,
              messageType: 'chat',
              isFinal: true,
              createdAt: new Date().toISOString(),
            };
            ctx.emit({
              type: 'message',
              data: message,
            });
          }

          // Emit completion status
          ctx.emit({
            type: 'status',
            data: {
              sessionId: options.sessionId,
              status: 'completed',
              requestId: options.requestId,
            },
          });

          resolve();
        } else if (code === null || code === 130) {
          console.error('[QwenEngine] Execution cancelled via abort signal');
          ctx.emit({
            type: 'status',
            data: {
              sessionId: options.sessionId,
              status: 'cancelled',
              requestId: options.requestId,
            },
          });
          reject(new Error('QwenEngine: execution was cancelled'));
        } else {
          const stderrOutput = stderrBuffer.join('\n');
          const errorMessage = `QwenEngine: process terminated with code ${code}\n${stderrOutput}`;
          ctx.emit({
            type: 'status',
            data: {
              sessionId: options.sessionId,
              status: 'error',
              message: errorMessage,
              requestId: options.requestId,
            },
          });
          reject(new Error(errorMessage));
        }
      });

      // Handle process errors
      qwen.on('error', (err) => {
        console.error('[QwenEngine] Process error:', err);
        const errorMessage = `QwenEngine: failed to start - ${err.message}`;
        ctx.emit({
          type: 'error',
          error: errorMessage,
          data: {
            sessionId: options.sessionId,
            requestId: options.requestId,
          },
        });
        reject(new Error(errorMessage));
      });

      // Handle abort signal
      signal?.addEventListener('abort', () => {
        console.error('[QwenEngine] Abort signal received');
        try {
          qwen.kill('SIGTERM');
        } catch (e) {
          // Ignore if already killed
        }
      });
    });
  }

  cancel(): void {
    this.abortController?.abort();
  }
}

/**
 * Extract tool name from log line.
 */
function extractToolName(line: string): string {
  // Try to match "Calling tool: toolName" or similar patterns
  const match =
    line.match(/Calling tool[:\s]+([a-zA-Z0-9_-]+)/i) ||
    line.match(/Running[:\s]+([a-zA-Z0-9_-]+)/i) ||
    line.match(/Using tool[:\s]+([a-zA-Z0-9_-]+)/i);

  if (match) {
    return match[1];
  }

  // Fallback: return first part of line
  return line.split(' ').slice(0, 3).join(' ') || 'unknown';
}
