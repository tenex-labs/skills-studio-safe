import { Beaker, BookOpen, Braces } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import { EditorView } from '../features/editor/EditorView';
import { LibraryView } from '../features/library/LibraryView';
import { TestLabView } from '../features/test-lab/TestLabView';
import { ReadinessBar } from '../ui/components';
import type { StudioView } from '../model/skill-view-model';
import { useStudio } from '../state/useStudio';

const routes: Array<{
  view: StudioView;
  label: string;
  icon: typeof BookOpen;
}> = [
  { view: 'library', label: 'Library', icon: BookOpen },
  { view: 'editor', label: 'Editor', icon: Braces },
  { view: 'test-lab', label: 'Test Lab', icon: Beaker },
];

function viewFromLocation(): StudioView {
  const value = window.location.pathname.split('/').filter(Boolean).at(-1);
  return routes.some(({ view }) => view === value) ? (value as StudioView) : 'library';
}

export default function App() {
  const studio = useStudio();
  const [view, setView] = useState<StudioView>(viewFromLocation);

  useEffect(() => {
    const onPopState = () => setView(viewFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (next: StudioView, event?: MouseEvent<HTMLAnchorElement>) => {
    event?.preventDefault();
    if (next === view) return;
    window.history.pushState({}, '', `/${next}`);
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="/library"
          onClick={(event) => navigate('library', event)}
          aria-label="Claude Skill Studio home"
        >
          <span aria-hidden="true">C</span>
          <strong>Claude Skill Studio</strong>
        </a>
        <p>Local skill development</p>
      </header>
      <nav className="primary-nav" aria-label="Primary navigation">
        {routes.map(({ view: itemView, label, icon: Icon }) => (
          <a
            href={`/${itemView}`}
            aria-current={view === itemView ? 'page' : undefined}
            key={itemView}
            onClick={(event) => navigate(itemView, event)}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </a>
        ))}
      </nav>
      <ReadinessBar readiness={studio.readiness} state={studio.readinessState} />
      <main>
        {view === 'library' && (
          <LibraryView
            skills={studio.skills}
            projects={studio.projects}
            state={studio.catalogState}
            error={studio.catalogError}
            demoMode={studio.demoMode}
            onScopeChange={(scope, projectId) => void studio.loadCatalog(scope, projectId)}
            onRegisterProject={studio.registerProject}
            onPickProject={studio.pickProject}
            onCreateSkill={(input) =>
              studio.createSkill(input).then(() => {
                navigate('editor');
              })
            }
            onOpen={(skill) => {
              void studio.openSkill(skill.id).then(() => navigate('editor'));
            }}
          />
        )}
        {view === 'editor' && (
          <EditorView
            key={studio.selectedSkill?.id ?? 'empty-editor'}
            skill={studio.selectedSkill}
            versions={studio.versions}
            onSave={studio.saveSkill}
          />
        )}
        {view === 'test-lab' && (
          <TestLabView
            key={studio.selectedSkill?.id ?? 'empty-test-lab'}
            skill={studio.selectedSkill}
            skills={studio.allSkills}
            projects={studio.projects}
            catalogState={studio.catalogState}
            versions={studio.versions}
            runs={studio.runs}
            tracesByRun={studio.tracesByRun}
            readiness={studio.readiness}
            demoMode={studio.demoMode}
            onLaunch={studio.launchTest}
            onCancel={studio.cancelTest}
            onReauthenticate={studio.reauthenticateClaude}
            onSkillChange={studio.openSkill}
          />
        )}
      </main>
    </div>
  );
}
