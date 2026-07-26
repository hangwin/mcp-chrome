import { beforeEach, describe, expect, it, vi } from 'vitest';

const tabGroupsStore = new Map<number, any>();
const tabsStore = new Map<number, any>();
let nextTabId = 100;
let nextGroupId = 1;
let nextWindowId = 1;

function resetChromeMock() {
  tabGroupsStore.clear();
  tabsStore.clear();
  nextTabId = 100;
  nextGroupId = 1;
  nextWindowId = 1;

  (globalThis as any).chrome = {
    tabGroups: {
      Color: { BLUE: 'blue' },
      TAB_GROUP_ID_NONE: -1,
      query: vi.fn(async (query: any = {}) => {
        return [...tabGroupsStore.values()].filter((g) => {
          if (query.title != null && g.title !== query.title) return false;
          return true;
        });
      }),
      update: vi.fn(async (groupId: number, props: any) => {
        const g = tabGroupsStore.get(groupId);
        Object.assign(g, props);
        return g;
      }),
    },
    tabs: {
      query: vi.fn(async (query: any = {}) => {
        return [...tabsStore.values()].filter((t) => {
          if (query.groupId != null && t.groupId !== query.groupId) return false;
          return true;
        });
      }),
      get: vi.fn(async (id: number) => {
        const t = tabsStore.get(id);
        if (!t) throw new Error('No tab');
        return t;
      }),
      create: vi.fn(async (props: any) => {
        const id = nextTabId++;
        const tab = {
          id,
          windowId: props.windowId ?? nextWindowId,
          url: props.url || 'about:blank',
          title: '',
          active: props.active === true,
          pinned: false,
          groupId: -1,
        };
        tabsStore.set(id, tab);
        return tab;
      }),
      update: vi.fn(async (id: number, props: any) => {
        const t = tabsStore.get(id);
        Object.assign(t, props);
        return t;
      }),
      group: vi.fn(async (opts: any) => {
        const tabIds = (Array.isArray(opts.tabIds) ? opts.tabIds : [opts.tabIds]).filter(Boolean);
        let groupId = opts.groupId;
        if (groupId == null) {
          groupId = nextGroupId++;
          const windowId = opts.createProperties?.windowId ?? tabsStore.get(tabIds[0])?.windowId;
          tabGroupsStore.set(groupId, {
            id: groupId,
            windowId,
            title: '',
            color: 'grey',
            collapsed: false,
          });
        }
        for (const id of tabIds) {
          const t = tabsStore.get(id);
          t.groupId = groupId;
          t.windowId = tabGroupsStore.get(groupId).windowId;
        }
        return groupId;
      }),
    },
    windows: {
      create: vi.fn(async (props: any = {}) => {
        const windowId = nextWindowId++;
        const tabId = nextTabId++;
        const tab = {
          id: tabId,
          windowId,
          url: props.url || 'about:blank',
          title: '',
          active: true,
          pinned: false,
          groupId: -1,
        };
        tabsStore.set(tabId, tab);
        return { id: windowId, tabs: [tab], focused: props.focused !== false };
      }),
      update: vi.fn(async (id: number) => ({ id })),
    },
  };
}

describe('mcp-tab-group helpers', () => {
  beforeEach(() => {
    resetChromeMock();
    vi.resetModules();
  });

  it('creates a labeled MCP group with createIfEmpty', async () => {
    const mod = await import('@/utils/mcp-tab-group');
    const ctx = await mod.ensureMcpTabGroup({ createIfEmpty: true, focusWindow: false });
    expect(ctx.created).toBe(true);
    expect(ctx.groupId).toBeTypeOf('number');
    expect(ctx.title).toBe('Chrome MCP');
    expect(ctx.tabs.length).toBe(1);
    const groups = await chrome.tabGroups.query({ title: 'Chrome MCP' });
    expect(groups[0].color).toBe('blue');
  });

  it('creates tabs inside the existing MCP group', async () => {
    const mod = await import('@/utils/mcp-tab-group');
    await mod.ensureMcpTabGroup({ createIfEmpty: true });
    const { groupId, tab } = await mod.createTabInMcpGroup({
      url: 'https://example.com',
      active: false,
    });
    expect(tab.url).toBe('https://example.com');
    const tabs = await mod.listMcpGroupTabs(groupId);
    expect(tabs.some((t) => t.tabId === tab.tabId)).toBe(true);
  });

  it('adopts existing tabs into the MCP group', async () => {
    const mod = await import('@/utils/mcp-tab-group');
    const outsider = await chrome.tabs.create({ url: 'https://adopt.example', active: false });
    const groupId = await mod.addTabsToMcpGroup([outsider.id!]);
    const tabs = await mod.listMcpGroupTabs(groupId);
    expect(tabs.map((t) => t.tabId)).toContain(outsider.id);
  });
});
