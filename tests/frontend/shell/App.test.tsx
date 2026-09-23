import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoSkills, demoVersions } from '../../../app/frontend/fixtures/demo';
import App from '../../../app/frontend/shell/App';

function jsonResponse(value: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => value,
  } as Response;
}

function renderOffline() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API unavailable')));
  const user = userEvent.setup();
  render(<App />);
  return user;
}

async function openDemoSkill(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Demo data');
  await user.click(screen.getByRole('button', { name: /code-review/i }));
  await screen.findByRole('heading', { name: 'code-review' });
}

function lane(name: 'A' | 'B') {
  return screen.getByRole('region', { name: `Configuration ${name} configuration and result` });
}

describe('Claude Skill Studio', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/library');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows degraded readiness and a clearly labeled fallback catalog', async () => {
    const user = renderOffline();

    expect(screen.getByRole('heading', { name: 'Skill library' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(await screen.findByText('Demo data')).toBeInTheDocument();
    expect(
      screen.getByText('Readiness unavailable. Editing and demo browsing remain available.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Valid')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search skills' }), 'no-match');
    expect(screen.getByText('Try a broader search.')).toBeInTheDocument();
  });

  it('labels a project skill that a same-name personal skill shadows', async () => {
    const user = renderOffline();
    await screen.findByText('Demo data');

    await user.click(screen.getByRole('button', { name: 'Project' }));
    await user.click(screen.getByRole('button', { name: /Trusted project/ }));
    await user.click(screen.getByRole('option', { name: /Workshop project/ }));

    expect(
      await screen.findByText('Shadowed: a personal skill with this name wins'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 warning')).toBeInTheDocument();
  });

  it('tracks editor dirtiness and confirms a direct versioned save', async () => {
    const user = renderOffline();
    await openDemoSkill(user);

    const editor = screen.getByRole('textbox', { name: 'File content' });
    await user.type(editor, '\nNew review instruction.');
    expect(screen.getByText('Unsaved draft changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const saveDialog = screen.getByRole('dialog', { name: 'Save this version?' });
    await user.click(within(saveDialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/Version saved in Skill Studio/)).toBeInTheDocument();
    expect(screen.getByText('Working copy clean')).toBeInTheDocument();
  });

  it('runs both configurations in demo mode and shows final results', async () => {
    const user = renderOffline();
    await openDemoSkill(user);
    await user.click(screen.getByRole('link', { name: 'Test Lab' }));

    await user.type(screen.getByRole('textbox', { name: 'Prompt' }), 'Review this change.');
    await user.click(screen.getByRole('button', { name: 'Run both' }));

    await waitFor(() => expect(within(lane('A')).getByRole('status')).toHaveTextContent('passed'));
    expect(within(lane('B')).getByRole('status')).toHaveTextContent('passed');
    expect(within(lane('A')).getByText(/Demo response from sonnet/)).toBeInTheDocument();
  });

  it('streams two live runs and shows each final result', async () => {
    class MockEventSource {
      static instances: MockEventSource[] = [];
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();
      constructor(public url: string) {
        MockEventSource.instances.push(this);
      }
      emit(value: unknown) {
        this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent<string>);
      }
    }

    let runNumber = 0;
    const runningRuns = new Map<string, Record<string, unknown>>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      if (path === '/api/studio/readiness') {
        return jsonResponse({
          claude: { available: true, authenticated: true, version: '2.1.0' },
          database: 'ready',
          personalSkillsRoot: 'ready',
          activeTests: 0,
        });
      }
      if (path === '/api/studio/session') return jsonResponse({ capability: 'test-capability' });
      if (path === '/api/studio/projects') return jsonResponse({ projects: [] });
      if (path === '/api/studio/catalog') return jsonResponse({ skills: [demoSkills[0]] });
      if (path === `/api/studio/skills/${demoSkills[0].id}`) {
        return jsonResponse({ skill: demoSkills[0] });
      }
      if (path.endsWith('/versions')) return jsonResponse({ versions: demoVersions });
      if (path.startsWith('/api/studio/test-runs?')) return jsonResponse({ testRuns: [] });
      if (path === '/api/studio/test-runs' && method === 'POST') {
        runNumber += 1;
        const body = JSON.parse(String(init?.body)) as {
          versionId: string;
          prompt: string;
          model: string;
        };
        const run = {
          id: `run-${runNumber}`,
          skillId: demoSkills[0].id,
          versionId: body.versionId,
          prompt: body.prompt,
          model: body.model,
          status: 'running',
          assertions: [],
        };
        runningRuns.set(run.id, run);
        return jsonResponse({ testRun: run });
      }
      if (path.startsWith('/api/studio/test-runs/run-')) {
        const id = path.split('/').at(-1)!;
        return jsonResponse({
          testRun: {
            ...runningRuns.get(id),
            id,
            status: 'passed',
            durationMs: 800,
            output: id === 'run-1' ? 'Sonnet finding.' : 'Haiku finding.',
            assertions: [],
          },
        });
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('EventSource', MockEventSource);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /code-review/i }));
    await screen.findByRole('heading', { name: 'code-review' });
    await user.click(screen.getByRole('link', { name: 'Test Lab' }));
    await user.type(screen.getByLabelText('Prompt'), 'Review this sample.');
    await user.click(screen.getByRole('button', { name: 'Run both' }));

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(2));
    const [first, second] = MockEventSource.instances;
    expect(first!.url).toBe('/api/studio/test-runs/run-1/events');
    const trace = { timestamp: '2026-09-22T14:00:00Z', kind: 'assistant' };
    first!.emit({ ...trace, id: 'trace-1', text: 'Sonnet finding.' });
    // A reconnect replays earlier traces; the UI must not duplicate them.
    first!.emit({ ...trace, id: 'trace-1', text: 'Sonnet finding.' });
    second!.emit({ ...trace, id: 'trace-2', text: 'Haiku finding.' });
    expect(await within(lane('A')).findByText('Sonnet finding.')).toBeInTheDocument();
    expect(within(lane('B')).getByText('Haiku finding.')).toBeInTheDocument();

    first!.emit({ id: 'result-1', timestamp: trace.timestamp, kind: 'result', status: 'passed' });
    second!.emit({ id: 'result-2', timestamp: trace.timestamp, kind: 'result', status: 'passed' });

    await waitFor(() => expect(within(lane('A')).getByRole('status')).toHaveTextContent('passed'));
    expect(within(lane('B')).getByRole('status')).toHaveTextContent('passed');
    expect(first!.close).toHaveBeenCalled();
    expect(within(lane('A')).getByText('Final')).toBeInTheDocument();
  });

  it('keeps version and model menus aligned in the experiment lab', async () => {
    const user = renderOffline();
    await openDemoSkill(user);
    await user.click(screen.getByRole('link', { name: 'Test Lab' }));

    expect(lane('A')).toBeInTheDocument();
    expect(lane('B')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Skill version/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Model/ })).toHaveLength(2);
  });
});
