import { AlertTriangle, CheckCircle2, Code2, Eye, File, GitCommit, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SkillFile, SkillPackage, SkillVersion } from '../../../domain/index';
import { EmptyState, Modal, PageHeading, StateText } from '../../ui/components';
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
  onSave,
}: {
  skill?: SkillPackage;
  versions: SkillVersion[];
  onSave: (input: { files: SkillFile[] }) => Promise<{ skill: SkillPackage }>;
}) {
  const [baseline, setBaseline] = useState<SkillFile[]>(skill?.files ?? []);
  const [files, setFiles] = useState<SkillFile[]>(skill?.files ?? []);
  const [selectedPath, setSelectedPath] = useState(skill?.files[0]?.path ?? '');
  const [saveOpen, setSaveOpen] = useState(false);
  const [contentMode, setContentMode] = useState<'markdown' | 'preview'>('markdown');
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

  const saveChanges = async () => {
    const result = await onSave({
      files,
    });
    setBaseline(result.skill.files);
    setFiles(result.skill.files);
    setSaveOpen(false);
    setMessage('Version saved in Skill Studio. The installed source was not changed.');
  };

  return (
    <>
      <PageHeading
        title={skill.name}
        description="Edit the skill, preview the result, and save with automatic version history."
        action={
          <div className="button-row">
            <StateText tone={dirty ? 'warning' : 'success'}>
              {dirty ? 'Unsaved draft changes' : 'Working copy clean'}
            </StateText>
            <button className="button primary" disabled={!dirty} onClick={() => setSaveOpen(true)}>
              <Save size={17} aria-hidden="true" />
              Save changes
            </button>
          </div>
        }
      />
      {skill.readOnly && (
        <div className="notice warning">
          <AlertTriangle size={17} aria-hidden="true" />
          This source is managed elsewhere. Studio saves remain local versions and never overwrite
          the installed skill.
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
        <div className="metadata-description">
          <span>Description</span>
          <strong>{metadata.description ?? 'Missing'}</strong>
        </div>
        <div className="metadata-source">
          <span>Source</span>
          <strong title={skill.sourcePath}>{skill.sourcePath ?? skill.relativePath}</strong>
        </div>
        <div>
          <span>Scope</span>
          <strong>{skill.scope}</strong>
        </div>
        <div>
          <span>Files</span>
          <strong>{skill.fileCount}</strong>
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
        <section className="panel editor-panel" aria-label="Skill content">
          <div className="panel-heading">
            <strong>{selected?.path ?? 'No file selected'}</strong>
            <div className="content-tabs" role="tablist" aria-label="Skill content view">
              <button
                role="tab"
                aria-selected={contentMode === 'markdown'}
                onClick={() => setContentMode('markdown')}
              >
                <Code2 size={15} aria-hidden="true" />
                Markdown
              </button>
              <button
                role="tab"
                aria-selected={contentMode === 'preview'}
                onClick={() => setContentMode('preview')}
              >
                <Eye size={15} aria-hidden="true" />
                Preview
              </button>
            </div>
          </div>
          {contentMode === 'markdown' ? (
            <textarea
              aria-label="File content"
              value={selected?.content ?? ''}
              readOnly={!selected}
              onChange={(event) =>
                setFiles((current) => updateFile(current, selectedPath, event.target.value))
              }
              spellCheck={false}
            />
          ) : (
            <MarkdownPreview content={selected?.content ?? ''} />
          )}
        </section>
      </div>
      <div className="editor-bottom">
        <section className="panel findings-panel" aria-labelledby="findings-title">
          <div className="panel-heading">
            <h2 id="findings-title">Validation findings</h2>
            <StateText
              tone={
                skill.validation.errors
                  ? 'danger'
                  : skill.validation.warnings
                    ? 'warning'
                    : 'success'
              }
            >
              {validationLabel(skill.validation)}
            </StateText>
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
            <StateText>{versions.length} versions</StateText>
          </div>
          {versions.length === 0 ? (
            <p className="panel-copy">No immutable drafts yet.</p>
          ) : (
            <ol className="version-list">
              {versions.map((version) => (
                <li key={version.id}>
                  <GitCommit size={17} aria-hidden="true" />
                  <div>
                    <strong>{version.label}</strong>
                    <small>
                      {version.source} · {new Date(version.createdAt).toLocaleString()}
                    </small>
                    <p>{version.note || 'No note'}</p>
                    <span>{packageDiffSummary(skill.files, version.files)}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      {saveOpen && (
        <Modal
          title="Save this version?"
          confirmLabel="Save changes"
          onClose={() => setSaveOpen(false)}
          onConfirm={() => void saveChanges()}
        >
          <p>
            Skill Studio will save this working copy to local version history. The installed skill
            on your computer will not be changed.
          </p>
        </Modal>
      )}
    </>
  );
}
