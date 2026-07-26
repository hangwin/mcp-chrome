#!/usr/bin/env node
/**
 * End-to-end test for MCP pin-group tools against a running native host.
 *
 * Prerequisites:
 * 1. Unpacked extension rebuilt with tabGroups support is loaded in Chrome
 * 2. Click Reload on chrome://extensions for Chrome MCP
 * 3. Extension Connected (native host on 127.0.0.1:12307)
 *
 * Usage: node scripts/e2e-tab-group.mjs
 */
const BASE = process.env.MCP_URL || 'http://127.0.0.1:12307/mcp';

async function rpc(session, payload) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(session ? { 'Mcp-Session-Id': session } : {}),
    },
    body: JSON.stringify(payload),
  });
  const sid = res.headers.get('mcp-session-id') || session;
  const body = await res.text();
  const results = [];
  for (const line of body.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        results.push(JSON.parse(line.slice(6)));
      } catch {
        // ignore
      }
    }
  }
  return { sid, results, body };
}

function parseTool(results) {
  if (!results.length) return { error: 'empty' };
  const r = results[0];
  if (r.error) return { error: r.error };
  const text = (r.result?.content || []).map((c) => c.text || '').join('\n');
  if (text.includes('not found')) return { error: text };
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { raw: text };
  }
}

async function call(sid, name, args, id) {
  const { sid: s2, results } = await rpc(sid, {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: args },
  });
  return { sid: s2, ...parseTool(results) };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const ping = await fetch('http://127.0.0.1:12307/ping');
  assert(ping.ok, 'native host not reachable on :12307');

  let { sid } = await rpc(null, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'e2e-tab-group', version: '1' },
    },
  });
  await rpc(sid, { jsonrpc: '2.0', method: 'notifications/initialized' });

  const { results: listResults } = await rpc(sid, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
  });
  const names = (listResults[0]?.result?.tools || []).map((t) => t.name);
  for (const n of ['chrome_tabs_context', 'chrome_tabs_create', 'chrome_tabs_adopt']) {
    assert(names.includes(n), `tools/list missing ${n}`);
  }
  console.log('✓ tools/list exposes pin-group tools');

  let r = await call(sid, 'get_windows_and_tabs', {}, 3);
  sid = r.sid;
  assert(r.data?.windows, `extension not connected: ${JSON.stringify(r)}`);
  console.log(`✓ extension connected (${r.data.windowCount} windows, ${r.data.tabCount} tabs)`);

  r = await call(sid, 'chrome_tabs_context', { createIfEmpty: true }, 4);
  sid = r.sid;
  assert(r.data?.groupId != null, `chrome_tabs_context failed: ${JSON.stringify(r)}`);
  const groupId = r.data.groupId;
  console.log(`✓ chrome_tabs_context groupId=${groupId} tabs=${r.data.tabCount} created=${r.data.created}`);

  r = await call(sid, 'chrome_tabs_create', { url: 'https://example.com' }, 5);
  sid = r.sid;
  assert(r.data?.tabId, `chrome_tabs_create failed: ${JSON.stringify(r)}`);
  const createdTabId = r.data.tabId;
  console.log(`✓ chrome_tabs_create tabId=${createdTabId}`);

  r = await call(sid, 'chrome_tabs_context', {}, 6);
  sid = r.sid;
  assert(
    (r.data?.tabs || []).some((t) => t.tabId === createdTabId),
    'created tab not listed in MCP group',
  );
  console.log(`✓ created tab is in group (tabCount=${r.data.tabCount})`);

  r = await call(sid, 'get_windows_and_tabs', {}, 7);
  sid = r.sid;
  assert(r.data?.mcpGroup?.groupId === groupId, 'get_windows_and_tabs missing mcpGroup');
  const flagged = r.data.windows
    .flatMap((w) => w.tabs)
    .filter((t) => t.mcpGroup)
    .map((t) => t.tabId);
  assert(flagged.includes(createdTabId), 'created tab not flagged mcpGroup:true');
  console.log(`✓ get_windows_and_tabs reports mcpGroup (${flagged.length} grouped tabs)`);

  // Adopt an outside http(s) tab if available
  const outsider = r.data.windows
    .flatMap((w) => w.tabs)
    .find((t) => !t.mcpGroup && /^https?:/.test(t.url || ''));
  if (outsider) {
    r = await call(sid, 'chrome_tabs_adopt', { tabIds: [outsider.tabId] }, 8);
    sid = r.sid;
    assert(r.data?.success, `chrome_tabs_adopt failed: ${JSON.stringify(r)}`);
    console.log(`✓ chrome_tabs_adopt tabId=${outsider.tabId}`);
  } else {
    console.log('· chrome_tabs_adopt skipped (no outside http tab)');
  }

  console.log('\nE2E PASS');
}

main().catch((err) => {
  console.error('\nE2E FAIL:', err.message || err);
  process.exit(1);
});
