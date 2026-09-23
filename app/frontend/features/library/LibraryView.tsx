import { AlertTriangle, FolderOpen, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SkillScope, SkillSummary, TrustedProject } from '../../../domain/index';
import {
  conflictLabel,
  filterCatalog,
  validationLabel,
  type LoadState,
} from '../../model/skill-view-model';
import { EmptyState, Modal, PageHeading } from '../../ui/components';
import { SelectMenu } from '../../ui/SelectMenu';

export function LibraryView({
  skills,
  projects,
  state,
  error,
  demoMode,
  onScopeChange,
  onOpen,
  onRegisterProject,
  onPickProject,
  onCreateSkill,
}: {
  skills: SkillSummary[];
  projects: TrustedProject[];
  state: LoadState;
  error: string;
  demoMode: boolean;
  onScopeChange: (scope: SkillScope, projectId?: string) => void;
  onOpen: (skill: SkillSummary) => void;
  onRegisterProject: (input: { label: string; path: string }) => Promise<TrustedProject>;
  onPickProject: () => Promise<{ label: string; path: string }>;
  onCreateSkill: (input: {
    scope: SkillScope;
    projectId?: string;
    name: string;
    description: string;
  }) => Promise<void>;
}) {
  const [scope, setScope] = useState<SkillScope>('personal');
  const [projectId, setProjectId] = useState('');
  const [query, setQuery] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const filtered = useMemo(() => filterCatalog(skills, query), [query, skills]);

  const chooseScope = (next: SkillScope) => {
    setScope(next);
    onScopeChange(next, next === 'project' ? projectId || undefined : undefined);
  };

  const chooseProject = (nextId: string) => {
    setProjectId(nextId);
    if (nextId) onScopeChange('project', nextId);
  };

  return (
    <>
      <PageHeading
        title="Skill library"
        description="Browse installed personal and trusted project skills, validation, and conflicts."
        action={
          <div className="button-row">
            {demoMode && (
              <span className="quiet-state" data-tone="warning">
                Demo data
              </span>
            )}
            <button
              className="button primary"
              disabled={demoMode || (scope === 'project' && !projectId)}
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={17} aria-hidden="true" />
              New skill
            </button>
          </div>
        }
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
            <SelectMenu
              label="Trusted project"
              value={projectId}
              placeholder="Choose a project"
              options={projects.map((project) => ({
                value: project.id,
                label: project.label,
                description: `${project.skillCount} skill${project.skillCount === 1 ? '' : 's'}`,
              }))}
              onChange={chooseProject}
              hideLabel
            />
            <button
              className="button secondary"
              onClick={() => {
                setRegisterError('');
                void onPickProject()
                  .then((selection) => onRegisterProject(selection))
                  .then((project) => {
                    setProjectId(project.id);
                    onScopeChange('project', project.id);
                  })
                  .catch(() =>
                    setRegisterError(
                      'The folder picker was cancelled or is unavailable on this computer.',
                    ),
                  );
              }}
            >
              <FolderOpen size={17} aria-hidden="true" />
              Choose project folder
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
      {registerError && (
        <p className="notice warning" role="status">
          {registerError}
        </p>
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
              <span>
                <strong>{skill.name}</strong>
                <small>{skill.description}</small>
              </span>
            </div>
            <div className="skill-card-meta">
              <span>{skill.scope}</span>
              <span
                data-state={
                  skill.validation.errors
                    ? 'error'
                    : skill.validation.warnings
                      ? 'warning'
                      : 'valid'
                }
              >
                {validationLabel(skill.validation)}
              </span>
              <span>{skill.readOnly ? 'Managed source' : 'Editable source'}</span>
            </div>
            {skill.shadowedBy && <p className="skill-conflict">{conflictLabel(skill)}</p>}
            <dl className="card-facts">
              <div>
                <dt>Source</dt>
                <dd title={skill.sourcePath}>{skill.sourcePath ?? skill.relativePath}</dd>
              </div>
              <div>
                <dt>Files</dt>
                <dd>{skill.fileCount}</dd>
              </div>
            </dl>
          </button>
        ))}
      </section>
      {createOpen && (
        <Modal
          title="Create a skill"
          confirmLabel="Create skill"
          confirmDisabled={!skillName.trim() || !skillDescription.trim()}
          onClose={() => setCreateOpen(false)}
          onConfirm={() => {
            void onCreateSkill({
              scope,
              projectId: scope === 'project' ? projectId : undefined,
              name: skillName,
              description: skillDescription,
            }).then(() => {
              setCreateOpen(false);
              setSkillName('');
              setSkillDescription('');
            });
          }}
        >
          <p>
            Create this skill in{' '}
            {scope === 'personal' ? 'your personal library' : 'the selected project'}.
          </p>
          <label>
            Skill name
            <input
              autoFocus
              value={skillName}
              placeholder="review-small-change"
              onChange={(event) => setSkillName(event.target.value)}
            />
          </label>
          <label>
            Description
            <textarea
              value={skillDescription}
              placeholder="What this skill does and when Claude should use it"
              onChange={(event) => setSkillDescription(event.target.value)}
            />
          </label>
        </Modal>
      )}
    </>
  );
}
