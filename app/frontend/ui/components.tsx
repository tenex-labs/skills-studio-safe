import type { ReactNode } from 'react';
import type { StudioReadiness } from '../../domain/index';
import type { LoadState } from '../model/skill-view-model';

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export function StateText({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
  children: ReactNode;
}) {
  return (
    <span className="quiet-state" data-tone={tone}>
      {children}
    </span>
  );
}

export function ReadinessBar({
  readiness,
  state,
}: {
  readiness: StudioReadiness;
  state: LoadState;
}) {
  const claudeReady = readiness.claude.available && readiness.claude.authenticated;
  return (
    <section className="readiness-bar" aria-label="Studio readiness" aria-live="polite">
      <div className="readiness-title">
        <strong>Local setup</strong>
      </div>
      <div className="readiness-items">
        <span data-state={claudeReady ? 'ready' : 'warning'}>
          Claude:{' '}
          {readiness.authLogin?.state === 'completed'
            ? 'sign-in refreshed'
            : readiness.authLogin?.state === 'running'
              ? 'sign-in in progress'
              : claudeReady
                ? 'account found'
                : 'sign-in required'}
        </span>
        <span data-state={readiness.database === 'ready' ? 'ready' : 'warning'}>
          Draft store: {readiness.database}
        </span>
        <span data-state={readiness.activeTests ? 'active' : 'neutral'}>
          Active tests: {readiness.activeTests}
        </span>
      </div>
      <p>
        {state === 'error'
          ? 'Readiness unavailable. Editing and demo browsing remain available.'
          : 'Test content stays local. Partial live traces are ephemeral.'}
      </p>
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

export function Modal({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  confirmDisabled = false,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  confirmDisabled?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">{title}</h2>
        <div>{children}</div>
        <div className="button-row">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
