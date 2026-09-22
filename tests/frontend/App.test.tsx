import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoSkills, demoVersions } from '../../app/frontend/fixtures/demo';
import App from '../../app/frontend/shell/App';

function jsonResponse(value: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => value,
  } as Response;
}

async function openDemoSkill(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Workshop demo data');
  await user.click(screen.getByRole('button', { name: /code-review/i }));
  await screen.findByRole('heading', { name: 'code-review' });
}

describe('Claude Skill Studio', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/library');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows degraded readiness and a clearly labeled fallback catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API unavailable')));
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Skill library' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(await screen.findByText('Workshop demo data')).toBeInTheDocument();
    expect(
      screen.getByText('Readiness unavailable. Editing and demo browsing remain available.'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 warning')).toBeInTheDocument();
    expect(screen.getByText('Shadowed by Workshop project')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search skills' }), 'no-match');
    expect(screen.getByText('Try a broader search.')).toBeInTheDocument();
  });

  it('tracks editor dirtiness, creates a draft, and confirms promotion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API unavailable')));
    const user = userEvent.setup();
    render(<App />);
    await openDemoSkill(user);

    const editor = screen.getByRole('textbox', { name: 'File content' });
    await user.type(editor, '\nNew review instruction.');
    expect(screen.getByText('Unsaved draft changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create draft' }));

    const draftDialog = screen.getByRole('dialog', { name: 'Create immutable draft' });
    await user.type(within(draftDialog).getByLabelText('Version label'), 'Workshop revision');
    await user.type(within(draftDialog).getByLabelText('Note (optional)'), 'Adds review guidance.');
    await user.click(within(draftDialog).getByRole('button', { name: 'Create draft' }));

    expect(await screen.findByText(/Draft “Workshop revision” created/)).toBeInTheDocument();
    expect(screen.getByText('Working copy clean')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Promote' })[0]);
    const promoteDialog = screen.getByRole('dialog', { name: 'Promote version?' });
    expect(
      within(promoteDialog).getByText(/changes which immutable package is installed/i),
    ).toBeInTheDocument();
    await user.click(within(promoteDialog).getByRole('button', { name: 'Promote version' }));
    expect(await screen.findByText(/promoted after confirmation/i)).toBeInTheDocument();
  });

  it('launches, streams, pauses, and cancels a local test', async () => {
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

    const running = {
      id: 'run-1',
      skillId: demoSkills[0].id,
      versionId: demoVersions[0].id,
      prompt: 'Review this sample.',
      model: 'claude-sonnet',
      status: 'running',
      assertions: [],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
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
      if (path.endsWith('/test-cases')) return jsonResponse({ testCases: [] });
      if (path === '/api/studio/test-runs' && !init?.method) {
        return jsonResponse({ testRuns: [] });
      }
      if (path === '/api/studio/test-runs' && init?.method === 'POST') {
        return jsonResponse({ testRun: running });
      }
      if (path.endsWith('/cancel')) {
        return jsonResponse({ testRun: { ...running, status: 'cancelled' } });
      }
      if (path === '/api/studio/test-runs/run-1') {
        return jsonResponse({
          testRun: {
            ...running,
            status: 'passed',
            durationMs: 800,
            output: 'A focused finding.',
            assertions: [{ label: 'Has finding', passed: true }],
          },
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('EventSource', MockEventSource);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('button', { name: /code-review/i });
    await user.click(screen.getByRole('button', { name: /code-review/i }));
    await screen.findByRole('heading', { name: 'code-review' });
    await user.click(screen.getByRole('link', { name: 'Test Lab' }));
    expect(screen.getByText(/Normal skill tests run without tools/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Prompt'), 'Review this sample.');
    await user.click(screen.getByRole('button', { name: 'Launch test' }));

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    expect(MockEventSource.instances[0].url).toBe('/api/studio/test-runs/run-1/events');
    MockEventSource.instances[0].emit({
      id: 'trace-1',
      timestamp: '2026-09-22T14:00:00Z',
      kind: 'assistant',
      text: 'Checking the response.',
    });
    expect(await screen.findByText('Checking the response.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause live trace' }));
    expect(screen.getByRole('button', { name: 'Resume live trace' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel test' }));
    expect(await screen.findByText('cancelled')).toBeInTheDocument();
    expect(MockEventSource.instances[0].close).toHaveBeenCalled();
  });

  it('compares version and test evidence with unavailable states', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API unavailable')));
    const user = userEvent.setup();
    render(<App />);
    await openDemoSkill(user);
    await user.click(screen.getByRole('link', { name: 'Compare' }));

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'First item' }),
      `version:${demoVersions[0].id}`,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Second item' }), 'run:demo-run');
    const comparison = screen.getByRole('region', { name: 'Skill comparison' });
    expect(within(comparison).getAllByText('Not applicable to a version')).toHaveLength(2);
    expect(within(comparison).getByText('410 in / 82 out')).toBeInTheDocument();
    expect(within(comparison).getByText('$0.0031')).toBeInTheDocument();
  });
});
