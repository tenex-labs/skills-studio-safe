import { AlertTriangle, CheckCircle2, File, GitCommit, RotateCcw, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SkillFile, SkillPackage, SkillVersion } from '../../../domain/index';
import { EmptyState, Modal, PageHeading, StatusPill } from '../../ui/components';
import {
  filesAreDirty,
  packageDiffSummary,
  parseSkillMetadata,
  updateFile,
  validationLabel,
} from '../../model/skill-view-model';

function MarkdownPreview({ content }: { content: string }) {
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
  return (
    <div className="markdown-preview" aria-label="Safe preview">
      {body.split(/\r?\n/).map((line, index) => {
        const key = `${index}-${line.slice(0, 8)}`;
        if (line.startsWith('### ')) return <h4 key={key}>{line.slice(4)}</h4>;
        if (line.startsWith('## ')) return <h3 key={key}>{line.slice(3)}</h3>;
        if (line.startsWith('# ')) return <h2 key={key}>{line.slice(2)}</h2>;
        if (line.startsWith('- ')) return <p key={key}>• {line.slice(2)}</p>;
        return line ? <p key={key}>{line}</p> : <br key={key} />;
      })}
    </div>
  );
}

export function EditorView({
  skill,
  versions,
  onCreateVersion,
  onPromote,
}: {
  skill?: SkillPackage;
  versions: SkillVersion[];
  onCreateVersion: (input: {
    label: string;
    note?: string;
    files: SkillFile[];
  }) => Promise<SkillVersion>;
  onPromote: (versionId: string) => Promise<void>;
}) {
  const [baseline, setBaseline] = useState<SkillFile[]>(skill?.files ?? []);
  const [files, setFiles] = useState<SkillFile[]>(skill?.files ?? []);
  const [selectedPath, setSelectedPath] = useState(skill?.files[0]?.path ?? '');
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [promoteTarget, setPromoteTarget] = useState<SkillVersion>();
  const [message, setMessage] = useState('');

  const selected = files.find((file) => file.path === selectedPath);
  const skillFile = files.find((file) => file.path === 'SKILL.md');
  const metadata = useMemo(
    () => parseSkillMetadata(skillFile?.content ?? ''),
    [skillFile?.content],
  );
  const dirty = filesAreDirty(baseline, files);

  if (!skill) {
    return (
      <>
        <PageHeading
          title="Skill editor"
          description="Create immutable drafts without changing installed files."
        />
        <EmptyState title="Select a skill">
          Open a skill from the library to edit its package.
        </EmptyState>
      </>
    );
  }

  const saveDraft = async () => {
    const version = await onCreateVersion({
      label: draftLabel,
      note: draftNote || undefined,
      files,
    });
    setBaseline(version.files);
    setDraftOpen(false);
    setDraftLabel('');
    setDraftNote('');
    setMessage(`Draft “${version.label}” created. Installed files were not changed.`);
  };

  return (
    <>
      <PageHeading
        title={skill.name}
        description="Edit a working copy, validate its package, and save an immutable draft."
        action={
          <div className="button-row">
            <StatusPill tone={dirty ? 'warning' : 'success'}>
              {dirty ? 'Unsaved draft changes' : 'Working copy clean'}
            </StatusPill>
            <button
              className="button primary"
              disabled={!dirty || skill.readOnly}
              onClick={() => setDraftOpen(true)}
            >
              <Save size={17} aria-hidden="true" />
              Create draft
            </button>
          </div>
        }
      />
      {skill.readOnly && (
        <div className="notice warning">
          <AlertTriangle size={17} aria-hidden="true" />
          This installed source is read-only. Inspect it here or create a draft from a writable
          skill.
        </div>
      )}
      {message && (
        <p className="notice success" role="status">
          <CheckCircle2 size={17} aria-hidden="true" />
          {message}
        </p>
      )}
      <section className="metadata-strip" aria-label="SKILL.md metadata">
        <div>
          <span>Name</span>
          <strong>{metadata.name ?? 'Missing'}</strong>
        </div>
        <div>
          <span>Description</span>
          <strong>{metadata.description ?? 'Missing'}</strong>
        </div>
        <div>
          <span>Validation</span>
          <strong>{validationLabel(skill.validation)}</strong>
        </div>
        <div>
          <span>Package diff</span>
          <strong>{packageDiffSummary(baseline, files)}</strong>
        </div>
      </section>
      <div className="editor-layout">
        <aside className="panel file-tree" aria-label="Skill files">
          <h2>Files</h2>
          {files.map((file) => (
            <button
              className={file.path === selectedPath ? 'active' : ''}
              key={file.path}
              onClick={() => setSelectedPath(file.path)}
            >
              <File size={15} aria-hidden="true" />
              {file.path}
            </button>
          ))}
        </aside>
        <section className="panel editor-panel" aria-label="Text editor">
          <div className="panel-heading">
            <strong>{selected?.path ?? 'No file selected'}</strong>
            <span>Working copy</span>
          </div>
          <textarea
            aria-label="File content"
            value={selected?.content ?? ''}
            readOnly={skill.readOnly || !selected}
            onChange={(event) =>
              setFiles((current) => updateFile(current, selectedPath, event.target.value))
            }
            spellCheck={false}
          />
        </section>
        <section className="panel preview-panel">
          <div className="panel-heading">
            <strong>Preview</strong>
            <span>Text only · HTML disabled</span>
          </div>
          <MarkdownPreview content={selected?.content ?? ''} />
        </section>
      </div>
      <div className="editor-bottom">
        <section className="panel findings-panel" aria-labelledby="findings-title">
          <div className="panel-heading">
            <h2 id="findings-title">Validation findings</h2>
            <StatusPill
              tone={
                skill.validation.errors
                  ? 'danger'
                  : skill.validation.warnings
                    ? 'warning'
                    : 'success'
              }
            >
              {validationLabel(skill.validation)}
            </StatusPill>
          </div>
          {skill.findings.length === 0 ? (
            <p className="panel-copy">No validation findings.</p>
          ) : (
            <ul className="finding-list">
              {skill.findings.map((finding) => (
                <li key={finding.id} data-severity={finding.severity}>
                  <strong>{finding.severity}</strong>
                  <span>{finding.message}</span>
                  <small>
                    {finding.file ?? 'Package'}
                    {finding.line ? `:${finding.line}` : ''}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel versions-panel" aria-labelledby="versions-title">
          <div className="panel-heading">
            <h2 id="versions-title">Version timeline</h2>
            <StatusPill>{versions.length} versions</StatusPill>
          </div>
          {versions.length === 0 ? (
            <p className="panel-copy">No immutable drafts yet.</p>
          ) : (
            <ol className="version-list">
              {versions.map((version, index) => (
                <li key={version.id}>
                  <GitCommit size={17} aria-hidden="true" />
                  <div>
                    <strong>{version.label}</strong>
                    <small>
                      {version.source} · {version.revision}
                    </small>
                    <p>{version.note || 'No note'}</p>
                    <span>{packageDiffSummary(skill.files, version.files)}</span>
                  </div>
                  <button className="button secondary" onClick={() => setPromoteTarget(version)}>
                    {index === 0 ? 'Promote' : 'Rollback to'}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      {draftOpen && (
        <Modal
          title="Create immutable draft"
          confirmLabel="Create draft"
          onClose={() => setDraftOpen(false)}
          onConfirm={() => void saveDraft()}
        >
          <p>The installed skill remains unchanged until a version is explicitly promoted.</p>
          <label>
            Version label
            <input
              autoFocus
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
            />
          </label>
          <label>
            Note (optional)
            <textarea value={draftNote} onChange={(event) => setDraftNote(event.target.value)} />
          </label>
        </Modal>
      )}
      {promoteTarget && (
        <Modal
          title={promoteTarget === versions[0] ? 'Promote version?' : 'Rollback installed version?'}
          confirmLabel={promoteTarget === versions[0] ? 'Promote version' : 'Confirm rollback'}
          onClose={() => setPromoteTarget(undefined)}
          onConfirm={() => {
            void onPromote(promoteTarget.id).then(() => {
              setMessage(`“${promoteTarget.label}” promoted after confirmation.`);
              setPromoteTarget(undefined);
            });
          }}
        >
          <p>
            This changes which immutable package is installed. The current version remains in the
            timeline and can be restored later.
          </p>
          <p>
            <RotateCcw size={15} aria-hidden="true" />{' '}
            {packageDiffSummary(skill.files, promoteTarget.files)}
          </p>
        </Modal>
      )}
    </>
  );
}
