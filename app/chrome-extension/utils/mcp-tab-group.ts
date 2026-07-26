/**
 * Claude-in-Chrome style MCP tab group helpers.
 *
 * Keeps agent-owned tabs in a labeled Chrome tab group so users can tell
 * automation tabs apart from personal browsing, and so agents can pin work
 * to a stable set of tab IDs.
 */

export const MCP_TAB_GROUP_TITLE = 'Chrome MCP';
/** Chrome tabGroups.Color value; literal so tests can import without chrome.tabGroups mock. */
export const MCP_TAB_GROUP_COLOR = 'blue' as chrome.tabGroups.Color;

export interface McpGroupTabInfo {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  active: boolean;
  pinned: boolean;
}

export interface McpTabGroupContext {
  groupId: number | null;
  windowId: number | null;
  title: string;
  color: `${chrome.tabGroups.Color}`;
  tabs: McpGroupTabInfo[];
  created: boolean;
}

function toTabInfo(tab: chrome.tabs.Tab): McpGroupTabInfo | null {
  if (typeof tab.id !== 'number' || typeof tab.windowId !== 'number') return null;
  return {
    tabId: tab.id,
    windowId: tab.windowId,
    url: tab.url || '',
    title: tab.title || '',
    active: tab.active === true,
    pinned: tab.pinned === true,
  };
}

/**
 * Find an existing MCP tab group by title (and optionally color).
 * Returns null when Chrome has no matching group (empty groups are auto-removed).
 */
export async function findMcpTabGroup(): Promise<chrome.tabGroups.TabGroup | null> {
  const groups = await chrome.tabGroups.query({ title: MCP_TAB_GROUP_TITLE });
  if (!groups.length) return null;
  // Prefer the most recently updated / first match; Chrome does not expose last-used.
  return groups[0] || null;
}

export async function listMcpGroupTabs(groupId: number): Promise<McpGroupTabInfo[]> {
  const tabs = await chrome.tabs.query({ groupId });
  return tabs.map(toTabInfo).filter((t): t is McpGroupTabInfo => t !== null);
}

async function styleMcpGroup(groupId: number): Promise<void> {
  await chrome.tabGroups.update(groupId, {
    title: MCP_TAB_GROUP_TITLE,
    color: MCP_TAB_GROUP_COLOR,
    collapsed: false,
  });
}

/**
 * Add one or more tabs to the MCP group, creating the group if needed.
 * Tabs must already exist; they may be moved across windows into the group's window.
 */
export async function addTabsToMcpGroup(tabIds: number[]): Promise<number> {
  const uniqueIds = [...new Set(tabIds.filter((id) => typeof id === 'number'))];
  if (!uniqueIds.length) {
    throw new Error('At least one tabId is required');
  }

  const existing = await findMcpTabGroup();
  if (existing) {
    await chrome.tabs.group({ groupId: existing.id, tabIds: uniqueIds });
    await styleMcpGroup(existing.id);
    return existing.id;
  }

  const groupId = await chrome.tabs.group({ tabIds: uniqueIds });
  await styleMcpGroup(groupId);
  return groupId;
}

/**
 * Ensure an MCP tab group exists.
 * When createIfEmpty is true and no group exists, opens a background window
 * with a blank tab and pins it into a new labeled group (Claude-style).
 */
export async function ensureMcpTabGroup(options: {
  createIfEmpty?: boolean;
  focusWindow?: boolean;
}): Promise<McpTabGroupContext> {
  const createIfEmpty = options.createIfEmpty === true;
  const focusWindow = options.focusWindow === true;

  const existing = await findMcpTabGroup();
  if (existing) {
    const tabs = await listMcpGroupTabs(existing.id);
    return {
      groupId: existing.id,
      windowId: existing.windowId,
      title: existing.title || MCP_TAB_GROUP_TITLE,
      color: existing.color || MCP_TAB_GROUP_COLOR,
      tabs,
      created: false,
    };
  }

  if (!createIfEmpty) {
    return {
      groupId: null,
      windowId: null,
      title: MCP_TAB_GROUP_TITLE,
      color: MCP_TAB_GROUP_COLOR,
      tabs: [],
      created: false,
    };
  }

  const win = await chrome.windows.create({
    url: 'about:blank',
    focused: focusWindow,
    type: 'normal',
  });
  const firstTab = win.tabs?.[0];
  if (!win.id || !firstTab?.id) {
    throw new Error('Failed to create MCP window/tab for tab group');
  }

  const groupId = await chrome.tabs.group({
    tabIds: [firstTab.id],
    createProperties: { windowId: win.id },
  });
  await styleMcpGroup(groupId);

  const tabs = await listMcpGroupTabs(groupId);
  return {
    groupId,
    windowId: win.id,
    title: MCP_TAB_GROUP_TITLE,
    color: MCP_TAB_GROUP_COLOR,
    tabs,
    created: true,
  };
}

/**
 * Create a new tab inside the MCP group. Creates the group if missing.
 */
export async function createTabInMcpGroup(options: {
  url?: string;
  active?: boolean;
}): Promise<{ groupId: number; tab: McpGroupTabInfo }> {
  const active = options.active === true;
  const url = options.url && options.url.trim() ? options.url.trim() : 'about:blank';

  let group = await findMcpTabGroup();
  let windowId: number | undefined = group?.windowId;

  if (!group) {
    const ensured = await ensureMcpTabGroup({ createIfEmpty: true, focusWindow: false });
    if (ensured.groupId == null || ensured.windowId == null) {
      throw new Error('Failed to create MCP tab group');
    }
    // Reuse the blank starter tab when creating the first real navigation.
    const starter = ensured.tabs[0];
    if (starter && (!starter.url || starter.url === 'about:blank') && url !== 'about:blank') {
      const updated = await chrome.tabs.update(starter.tabId, { url, active });
      if (!updated) throw new Error('Failed to update starter MCP tab');
      const info = toTabInfo(updated);
      if (!info) throw new Error('Failed to update starter MCP tab');
      return { groupId: ensured.groupId, tab: info };
    }
    group = await findMcpTabGroup();
    windowId = ensured.windowId;
  }

  if (!group || typeof windowId !== 'number') {
    throw new Error('MCP tab group unavailable');
  }

  const newTab = await chrome.tabs.create({
    url,
    windowId,
    active,
  });
  if (!newTab.id) throw new Error('Failed to create tab in MCP group');

  await chrome.tabs.group({ groupId: group.id, tabIds: [newTab.id] });
  await styleMcpGroup(group.id);

  const info = toTabInfo(newTab);
  if (!info) throw new Error('Created tab missing id');
  return { groupId: group.id, tab: info };
}

/**
 * If an MCP group already exists, add the tab to it (best-effort).
 * No-op when the group does not exist yet or the tab is already in it.
 */
export async function pinTabToMcpGroupIfPresent(tabId: number): Promise<number | null> {
  const group = await findMcpTabGroup();
  if (!group) return null;
  const tab = await chrome.tabs.get(tabId);
  if (tab.groupId === group.id) return group.id;
  await chrome.tabs.group({ groupId: group.id, tabIds: [tabId] });
  return group.id;
}
