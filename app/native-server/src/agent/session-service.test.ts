import { getDb } from './db';
import { createSession } from './session-service';

jest.mock('./db', () => ({ getDb: jest.fn(), sessions: {} }));

describe('new session search defaults', () => {
  const values = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (getDb as jest.Mock).mockReturnValue({ insert: () => ({ values }) });
  });

  it('persists Parallel for a fresh Claude session through the session service', async () => {
    const session = await createSession('project', 'claude');
    expect(session.optionsConfig).toEqual({ webSearchProvider: 'parallel' });
    expect(JSON.parse(values.mock.calls[0][0].optionsConfig)).toEqual(session.optionsConfig);
  });

  it('retains explicitly supplied settings and keeps other engines unchanged', async () => {
    const config = {
      tools: ['Read'],
      mcpServers: { existing: { url: 'https://example.org/mcp' } },
    };
    expect(
      (await createSession('project', 'claude', { optionsConfig: config })).optionsConfig,
    ).toEqual(config);
    expect((await createSession('project', 'claude', { optionsConfig: {} })).optionsConfig).toEqual(
      {},
    );
    expect((await createSession('project', 'codex')).optionsConfig).toBeUndefined();
  });
});
