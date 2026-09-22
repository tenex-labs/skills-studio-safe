import { AlertTriangle, FileText, FolderPlus, Lock, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SkillScope, SkillSummary, TrustedProject } from '../../../domain/index';
import {
  conflictLabel,
  filterCatalog,
  validationLabel,
  type LoadState,
} from '../../model/skill-view-model';
import { EmptyState, PageHeading, StatusPill } from '../../ui/components';

export function LibraryView({
  skills,
  projects,
  state,
  error,
  demoMode,
  onScopeChange,
  onOpen,
  onRegisterProject,
}: {
  skills: SkillSummary[];
  projects: TrustedProject[];
  state: LoadState;
  error: string;
  demoMode: boolean;
  onScopeChange: (scope: SkillScope, projectId?: string) => void;
  onOpen: (skill: SkillSummary) => void;
  onRegisterProject: (input: { label: string; path: string }) => Promise<TrustedProject>;
}) {
  const [scope, setScope] = useState<SkillScope>('personal');
  const [projectId, setProjectId] = useState('');
  const [query, setQuery] = useState('');
  const [registering, setRegistering] = useState(false);
  const [projectLabel, setProjectLabel] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const filtered = useMemo(() => filterCatalog(skills, query), [query, skills]);

  const chooseScope = (next: SkillScope) => {
    setScope(next);
    onScopeChange(next, next === 'project' ? projectId || undefined : undefined);
  };

  const chooseProject = (nextId: string) => {
    setProjectId(nextId);
    if (nextId) onScopeChange('project', nextId);
  };

  const register = async () => {
    const project = await onRegisterProject({ label: projectLabel, path: projectPath });
    setProjectId(project.id);
    setRegistering(false);
    setProjectLabel('');
    setProjectPath('');
    onScopeChange('project', project.id);
  };

  return (
    <>
      <PageHeading
        title="Skill library"
        description="Browse installed personal and trusted project skills, validation, and conflicts."
        action={demoMode ? <StatusPill tone="warning">Workshop demo data</StatusPill> : undefined}
      />
      {error && (
        <div className="notice warning" role="status">
          <AlertTriangle size={17} aria-hidden="true" />
          {error}
        </div>
      )}
      <section className="toolbar panel" aria-label="Library filters">
        <div className="segmented" aria-label="Skill scope">
          <button aria-pressed={scope === 'personal'} onClick={() => chooseScope('personal')}>
            Personal
          </button>
          <button aria-pressed={scope === 'project'} onClick={() => chooseScope('project')}>
            Project
          </button>
        </div>
        {scope === 'project' && (
          <>
            <label>
              <span>Trusted project</span>
              <select
                aria-label="Trusted project"
                value={projectId}
                onChange={(event) => chooseProject(event.target.value)}
              >
                <option value="">Choose a project</option>
                {projects.map((project) => (
                  <option value={project.id} key={project.id}>
                    {project.label} ({project.skillCount})
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary" onClick={() => setRegistering((value) => !value)}>
              <FolderPlus size={17} aria-hidden="true" />
              Register project
            </button>
          </>
        )}
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search skills</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, description, or source"
          />
        </label>
      </section>
      {registering && (
        <section className="panel registration" aria-labelledby="register-title">
          <h2 id="register-title">Register a trusted project</h2>
          <p>Only register a local project whose skills you intend to inspect and test.</p>
          <div className="form-grid">
            <label>
              Project label
              <input
                value={projectLabel}
                onChange={(event) => setProjectLabel(event.target.value)}
              />
            </label>
            <label>
              Local path
              <input value={projectPath} onChange={(event) => setProjectPath(event.target.value)} />
            </label>
            <button
              className="button primary"
              disabled={!projectLabel.trim() || !projectPath.trim()}
              onClick={() => void register()}
            >
              Trust and register
            </button>
          </div>
        </section>
      )}
      {state === 'loading' && (
        <EmptyState title="Loading skills">Reading the local catalog…</EmptyState>
      )}
      {state !== 'loading' && filtered.length === 0 && (
        <EmptyState title="No skills found">
          {query
            ? 'Try a broader search.'
            : scope === 'project' && !projectId
              ? 'Choose or register a trusted project.'
              : 'No skills are installed in this scope.'}
        </EmptyState>
      )}
      <section className="catalog-grid" aria-label="Skill catalog">
        {filtered.map((skill) => (
          <button className="skill-card" key={skill.id} onClick={() => onOpen(skill)}>
            <div className="skill-card-heading">
              <span className="skill-icon">
                <FileText size={18} aria-hidden="true" />
              </span>
              <span>
                <strong>{skill.name}</strong>
                <small>{skill.description}</small>
              </span>
            </div>
            <div className="skill-card-meta">
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
              {skill.shadowedBy && <StatusPill tone="warning">{conflictLabel(skill)}</StatusPill>}
              {skill.readOnly && (
                <StatusPill>
                  <Lock size={12} aria-hidden="true" /> Read-only
                </StatusPill>
              )}
            </div>
            <dl className="card-facts">
              <div>
                <dt>Source</dt>
                <dd>{skill.relativePath}</dd>
              </div>
              <div>
                <dt>Files</dt>
                <dd>{skill.fileCount}</dd>
              </div>
              <div>
                <dt>Revision</dt>
                <dd>{skill.revision}</dd>
              </div>
            </dl>
          </button>
        ))}
      </section>
    </>
  );
}
