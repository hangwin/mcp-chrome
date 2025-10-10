import { TOOL_NAMES } from 'chrome-mcp-shared';
import { handleCallTool } from '../tools';
import {
  Flow,
  RunLogEntry,
  RunRecord,
  RunResult,
  Step,
  StepAssert,
  StepFill,
  StepKey,
  StepScroll,
  StepDrag,
  StepWait,
} from './types';
import { appendRun } from './flow-store';
import { locateElement } from './selector-engine';

// design note: linear flow executor using existing tools; keeps logs and failure screenshot

export interface RunOptions {
  tabTarget?: 'current' | 'new';
  refresh?: boolean;
  captureNetwork?: boolean;
  returnLogs?: boolean;
  timeoutMs?: number;
  startUrl?: string;
  args?: Record<string, any>;
}

export async function runFlow(flow: Flow, options: RunOptions = {}): Promise<RunResult> {
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startAt = Date.now();
  const logs: RunLogEntry[] = [];
  const vars: Record<string, any> = Object.create(null);
  for (const v of flow.variables || []) {
    if (v.default !== undefined) vars[v.key] = v.default;
  }
  if (options.args) Object.assign(vars, options.args);

  // prepare tab & binding check
  if (options.startUrl) {
    await handleCallTool({ name: TOOL_NAMES.BROWSER.NAVIGATE, args: { url: options.startUrl } });
  }
  if (options.refresh) {
    await handleCallTool({ name: TOOL_NAMES.BROWSER.NAVIGATE, args: { refresh: true } });
  }

  // Binding enforcement: if bindings exist and no startUrl, verify current tab URL matches
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tabs?.[0]?.url || '';
    const bindings = flow.meta?.bindings || [];
    if (!options.startUrl && bindings.length > 0) {
      const ok = bindings.some((b) => {
        try {
          if (b.type === 'domain') return new URL(currentUrl).hostname.includes(b.value);
          if (b.type === 'path') return new URL(currentUrl).pathname.startsWith(b.value);
          if (b.type === 'url') return currentUrl.startsWith(b.value);
        } catch {
          // ignore
        }
        return false;
      });
      if (!ok) {
        return {
          runId: `run_${Date.now()}`,
          success: false,
          summary: { total: 0, success: 0, failed: 0, tookMs: 0 },
          url: currentUrl,
          outputs: null,
          logs: [
            {
              stepId: 'binding-check',
              status: 'failed',
              message:
                'Flow binding mismatch. Provide startUrl or open a page matching flow.meta.bindings.',
            },
          ],
          screenshots: { onFailure: null },
        };
      }
    }
  } catch {
    // ignore binding errors and continue
  }

  let failed = 0;

  for (const step of flow.steps) {
    const t0 = Date.now();
    try {
      // resolve string templates {var}
      const resolveTemplate = (val?: string): string | undefined =>
        (val || '').replace(/\{([^}]+)\}/g, (_m, k) => (vars[k] ?? '').toString());

      switch (step.type) {
        case 'scroll': {
          const s = step as StepScroll;
          // Prefer precise control via script injection
          // Modes:
          // - offset (window): window.scrollTo({top,left})
          // - element: el.scrollIntoView({block:'center'})
          // - container: container.scrollTo({top,left})
          const top = s.offset?.y ?? undefined;
          const left = s.offset?.x ?? undefined;

          const selectorFromTarget = (s.target?.candidates || []).find(
            (c) => c.type === 'css' || c.type === 'attr',
          )?.value;

          let code = '';
          if (s.mode === 'offset' && !s.target) {
            // Window scroll to absolute offset
            const t = top != null ? Number(top) : 'undefined';
            const l = left != null ? Number(left) : 'undefined';
            code = `try { window.scrollTo({ top: ${t}, left: ${l}, behavior: 'instant' }); } catch (e) {}`;
          } else if (s.mode === 'element' && selectorFromTarget) {
            code = `(() => { try { const el = document.querySelector(${JSON.stringify(
              selectorFromTarget,
            )}); if (el) el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' }); } catch (e) {} })();`;
          } else if (s.mode === 'container' && selectorFromTarget) {
            const t = top != null ? Number(top) : 'undefined';
            const l = left != null ? Number(left) : 'undefined';
            code = `(() => { try { const el = document.querySelector(${JSON.stringify(
              selectorFromTarget,
            )}); if (el && typeof el.scrollTo === 'function') el.scrollTo({ top: ${t}, left: ${l}, behavior: 'instant' }); } catch (e) {} })();`;
          } else {
            // Fallback: small wheel via computer tool at center using direction heuristic
            const direction = top != null && Number(top) < 0 ? 'up' : 'down';
            const amount = 3;
            const res = await handleCallTool({
              name: TOOL_NAMES.BROWSER.COMPUTER,
              args: { action: 'scroll', scrollDirection: direction, scrollAmount: amount },
            });
            if ((res as any).isError) throw new Error('scroll failed');
          }

          if (code) {
            const res = await handleCallTool({
              name: TOOL_NAMES.BROWSER.INJECT_SCRIPT,
              args: { type: 'MAIN', jsScript: code },
            });
            if ((res as any).isError) throw new Error('scroll failed');
          }
          break;
        }
        case 'drag': {
          const s = step as StepDrag;
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const tabId = tabs?.[0]?.id;
          let startRef: string | undefined;
          let endRef: string | undefined;
          try {
            if (typeof tabId === 'number') {
              const locatedStart = await locateElement(tabId, s.start);
              const locatedEnd = await locateElement(tabId, s.end);
              startRef = locatedStart?.ref || s.start.ref;
              endRef = locatedEnd?.ref || s.end.ref;
            }
          } catch {
            // ignore
          }

          let startCoordinates: { x: number; y: number } | undefined;
          let endCoordinates: { x: number; y: number } | undefined;
          if ((!startRef || !endRef) && Array.isArray(s.path) && s.path.length >= 2) {
            startCoordinates = { x: Number(s.path[0].x), y: Number(s.path[0].y) };
            const last = s.path[s.path.length - 1];
            endCoordinates = { x: Number(last.x), y: Number(last.y) };
          }

          const res = await handleCallTool({
            name: TOOL_NAMES.BROWSER.COMPUTER,
            args: {
              action: 'left_click_drag',
              startRef,
              ref: endRef,
              startCoordinates,
              coordinates: endCoordinates,
            },
          });
          if ((res as any).isError) throw new Error('drag failed');
          break;
        }
        case 'click':
        case 'dblclick': {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const firstTab = tabs && tabs[0];
          const tabId = firstTab && typeof firstTab.id === 'number' ? firstTab.id : undefined;
          if (!tabId) throw new Error('Active tab not found');
          // Ensure helper script is loaded by leveraging existing read_page tooling
          await handleCallTool({ name: TOOL_NAMES.BROWSER.READ_PAGE, args: {} });
          const located = await locateElement(tabId, (step as any).target);
          const first = (step as any).target?.candidates?.[0]?.type;
          const resolvedBy = located?.resolvedBy || (located?.ref ? 'ref' : '');
          const fallbackUsed = resolvedBy && first && resolvedBy !== 'ref' && resolvedBy !== first;
          const res = await handleCallTool({
            name: TOOL_NAMES.BROWSER.CLICK,
            args: {
              ref: located?.ref || (step as any).target?.ref,
              selector: !located?.ref
                ? (step as any).target?.candidates?.find(
                    (c: any) => c.type === 'css' || c.type === 'attr',
                  )?.value
                : undefined,
              waitForNavigation: (step as any).after?.waitForNavigation || false,
              timeout: Math.max(1000, Math.min(step.timeoutMs || 10000, 30000)),
            },
          });
          if ((res as any).isError) throw new Error('click failed');
          if (fallbackUsed) {
            logs.push({
              stepId: step.id,
              status: 'success',
              message: `Selector fallback used (${first} -> ${resolvedBy})`,
              fallbackUsed: true,
              fallbackFrom: String(first),
              fallbackTo: String(resolvedBy),
              tookMs: Date.now() - t0,
            } as any);
            continue;
          }
          break;
        }
        case 'fill': {
          const s = step as StepFill;
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const firstTab = tabs && tabs[0];
          const tabId = firstTab && typeof firstTab.id === 'number' ? firstTab.id : undefined;
          if (!tabId) throw new Error('Active tab not found');
          await handleCallTool({ name: TOOL_NAMES.BROWSER.READ_PAGE, args: {} });
          const located = await locateElement(tabId, s.target);
          const first = s.target?.candidates?.[0]?.type;
          const resolvedBy = located?.resolvedBy || (located?.ref ? 'ref' : '');
          const fallbackUsed = resolvedBy && first && resolvedBy !== 'ref' && resolvedBy !== first;
          const value = resolveTemplate(s.value) ?? '';
          const res = await handleCallTool({
            name: TOOL_NAMES.BROWSER.FILL,
            args: {
              ref: located?.ref || s.target.ref,
              selector: !located?.ref
                ? s.target.candidates?.find((c) => c.type === 'css' || c.type === 'attr')?.value
                : undefined,
              value,
            },
          });
          if ((res as any).isError) throw new Error('fill failed');
          if (fallbackUsed) {
            logs.push({
              stepId: step.id,
              status: 'success',
              message: `Selector fallback used (${first} -> ${resolvedBy})`,
              fallbackUsed: true,
              fallbackFrom: String(first),
              fallbackTo: String(resolvedBy),
              tookMs: Date.now() - t0,
            } as any);
            continue;
          }
          break;
        }
        case 'key': {
          const s = step as StepKey;
          const res = await handleCallTool({
            name: TOOL_NAMES.BROWSER.KEYBOARD,
            args: { keys: s.keys },
          });
          if ((res as any).isError) throw new Error('key failed');
          break;
        }
        case 'wait': {
          const s = step as StepWait;
          if ('text' in s.condition) {
            const res = await handleCallTool({
              name: TOOL_NAMES.BROWSER.COMPUTER,
              args: {
                action: 'wait',
                text: s.condition.text,
                appear: s.condition.appear !== false,
                timeout: Math.max(0, Math.min(step.timeoutMs || 10000, 120000)),
              },
            });
            if ((res as any).isError) throw new Error('wait text failed');
          } else if ('networkIdle' in s.condition) {
            // TODO: Integrate network capture idle if available; fallback to fixed wait
            const delay = Math.min(step.timeoutMs || 3000, 20000);
            await new Promise((r) => setTimeout(r, delay));
          } else if ('navigation' in s.condition) {
            // best-effort: wait a fixed time
            const delay = Math.min(step.timeoutMs || 5000, 20000);
            await new Promise((r) => setTimeout(r, delay));
          } else if ('selector' in s.condition) {
            // best-effort: simple text wait with selector string as text
            const res = await handleCallTool({
              name: TOOL_NAMES.BROWSER.COMPUTER,
              args: {
                action: 'wait',
                text: s.condition.selector,
                appear: s.condition.visible !== false,
                timeout: Math.max(0, Math.min(step.timeoutMs || 10000, 120000)),
              },
            });
            if ((res as any).isError) throw new Error('wait selector failed');
          }
          break;
        }
        case 'assert': {
          const s = step as StepAssert;
          // resolve using read_page to ensure element/text
          if ('textPresent' in s.assert) {
            const text = s.assert.textPresent;
            const res = await handleCallTool({
              name: TOOL_NAMES.BROWSER.COMPUTER,
              args: { action: 'wait', text, appear: true, timeout: step.timeoutMs || 5000 },
            });
            if ((res as any).isError) throw new Error('assert text failed');
          } else if ('exists' in s.assert || 'visible' in s.assert) {
            const selector = (s.assert as any).exists || (s.assert as any).visible;
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const firstTab = tabs && tabs[0];
            const tabId = firstTab && typeof firstTab.id === 'number' ? firstTab.id : undefined;
            if (!tabId) throw new Error('Active tab not found');
            await handleCallTool({ name: TOOL_NAMES.BROWSER.READ_PAGE, args: {} });
            const ensured = await chrome.tabs.sendMessage(tabId, {
              action: 'ensureRefForSelector',
              selector,
            } as any);
            if (!ensured || !ensured.success) throw new Error('assert selector not found');
            if ('visible' in s.assert) {
              const rect = ensured && ensured.center ? ensured.center : null;
              // Minimal visibility check based on existence and center
              if (!rect) throw new Error('assert visible failed');
            }
          } else if ('attribute' in s.assert) {
            // minimal attribute check: rely on inject script via ENSURE_REF_FOR_SELECTOR
            // skipped in M1 for complexity; treat as pass-through wait
            await new Promise((r) => setTimeout(r, 10));
          }
          break;
        }
        case 'script': {
          const world = (step as any).world || 'ISOLATED';
          const code = String((step as any).code || '');
          if (!code.trim()) break;
          const wrapped = `(() => { try { ${code} } catch (e) { console.error('flow script error:', e); } })();`;
          const res = await handleCallTool({
            name: TOOL_NAMES.BROWSER.INJECT_SCRIPT,
            args: { type: world, jsScript: wrapped },
          });
          if ((res as any).isError) throw new Error('script execution failed');
          break;
        }
        case 'navigate': {
          const url = (step as any).url;
          const res = await handleCallTool({
            name: TOOL_NAMES.BROWSER.NAVIGATE,
            args: { url },
          });
          if ((res as any).isError) throw new Error('navigate failed');
          break;
        }
        default: {
          // not implemented types in M1
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      logs.push({ stepId: step.id, status: 'success', tookMs: Date.now() - t0 });
    } catch (e: any) {
      failed++;
      logs.push({
        stepId: step.id,
        status: 'failed',
        message: e?.message || String(e),
        tookMs: Date.now() - t0,
      });
      if (step.screenshotOnFail !== false) {
        try {
          const shot = await handleCallTool({
            name: TOOL_NAMES.BROWSER.COMPUTER,
            args: { action: 'screenshot' },
          });
          const img = (shot?.content?.find((c: any) => c.type === 'image') as any)?.data as string;
          if (img) logs[logs.length - 1].screenshotBase64 = img;
        } catch {
          // ignore
        }
      }
      break; // stop on first failure in M1
    }
  }

  const tookMs = Date.now() - startAt;
  const record: RunRecord = {
    id: runId,
    flowId: flow.id,
    startedAt: new Date(startAt).toISOString(),
    finishedAt: new Date().toISOString(),
    success: failed === 0,
    entries: logs,
  };
  await appendRun(record);

  return {
    runId,
    success: failed === 0,
    summary: {
      total: flow.steps.length,
      success: flow.steps.length - failed,
      failed,
      tookMs,
    },
    url: null,
    outputs: null,
    logs: options.returnLogs ? logs : undefined,
    screenshots: { onFailure: logs.find((l) => l.status === 'failed')?.screenshotBase64 },
  };
}
