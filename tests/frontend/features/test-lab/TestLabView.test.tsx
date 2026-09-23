import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TestLabView } from '../../../../app/frontend/features/test-lab/TestLabView';
import { demoSkills, demoVersions } from '../../../../app/frontend/fixtures/demo';

describe('TestLabView', () => {
  it('selects a skill directly without requiring Library navigation', async () => {
    const user = userEvent.setup();
    const onSkillChange = vi.fn();
    render(
      <TestLabView
        skills={demoSkills}
        projects={[]}
        catalogState="ready"
        versions={[]}
        testCases={[]}
        runs={[]}
        tracesByRun={{}}
        readiness={{
          claude: { available: true, authenticated: true },
          database: 'ready',
          personalSkillsRoot: 'ready',
          activeTests: 0,
        }}
        demoMode={false}
        onLaunch={vi.fn()}
        onCancel={vi.fn()}
        onSaveTestCase={vi.fn()}
        onReauthenticate={vi.fn()}
        onSkillChange={onSkillChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Skill Search or choose/ }));
    await user.click(screen.getByRole('option', { name: /code-review, personal/ }));
    expect(onSkillChange).toHaveBeenCalledWith(demoSkills[0].id);
  });

  it('replaces an expired-token warning after the official login flow completes', () => {
    render(
      <TestLabView
        skill={demoSkills[0]}
        skills={demoSkills}
        projects={[]}
        catalogState="ready"
        versions={demoVersions}
        testCases={[]}
        runs={[
          {
            id: 'failed-run',
            skillId: demoSkills[0].id,
            versionId: demoVersions[0].id,
            prompt: 'Prompt',
            model: 'sonnet',
            status: 'failed',
            output: 'OAuth access token has expired.',
            assertions: [],
          },
        ]}
        tracesByRun={{}}
        readiness={{
          claude: { available: true, authenticated: true, version: '2.1.170' },
          authLogin: { state: 'completed', finishedAt: '2026-09-22T12:00:00Z' },
          database: 'ready',
          personalSkillsRoot: 'ready',
          activeTests: 0,
        }}
        demoMode={false}
        onLaunch={vi.fn()}
        onCancel={vi.fn()}
        onSaveTestCase={vi.fn()}
        onReauthenticate={vi.fn()}
        onSkillChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Claude sign-in completed')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Re-authenticate Claude' }),
    ).not.toBeInTheDocument();
  });
});
