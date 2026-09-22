import type { SkillPackage, SkillTestRun, SkillVersion } from '../../../domain/index';
import { comparisonRows, type ComparisonCandidate } from '../../model/skill-view-model';
import { EmptyState, PageHeading } from '../../ui/components';

const rows = [
  ['validation', 'Validation'],
  ['output', 'Final output'],
  ['assertions', 'Assertions'],
  ['model', 'Model'],
  ['duration', 'Duration'],
  ['tokens', 'Tokens'],
  ['cost', 'Cost'],
  ['notes', 'Notes'],
] as const;

export function CompareView({
  skill,
  versions,
  runs,
  leftId,
  rightId,
  onLeftChange,
  onRightChange,
}: {
  skill?: SkillPackage;
  versions: SkillVersion[];
  runs: SkillTestRun[];
  leftId: string;
  rightId: string;
  onLeftChange: (id: string) => void;
  onRightChange: (id: string) => void;
}) {
  const candidates: ComparisonCandidate[] = [
    ...versions.map((version): ComparisonCandidate => ({
      kind: 'version',
      id: `version:${version.id}`,
      label: `Version · ${version.label}`,
      version,
      skill,
    })),
    ...runs.map((run): ComparisonCandidate => ({
      kind: 'run',
      id: `run:${run.id}`,
      label: `Test · ${run.model} · ${run.status}`,
      run,
      findings: skill?.findings,
    })),
  ];
  const left = candidates.find(({ id }) => id === leftId);
  const right = candidates.find(({ id }) => id === rightId);
  const leftRows = comparisonRows(left);
  const rightRows = comparisonRows(right);

  return (
    <>
      <PageHeading
        title="Compare"
        description="Compare immutable versions or test runs. Missing evidence remains unavailable."
      />
      {!skill ? (
        <EmptyState title="Select a skill">
          Open a skill from the library to compare its versions and in-session test runs.
        </EmptyState>
      ) : (
        <>
          <section className="compare-selectors panel" aria-label="Comparison selectors">
            <label>
              First item
              <select value={leftId} onChange={(event) => onLeftChange(event.target.value)}>
                <option value="">Choose a version or test</option>
                {candidates.map((candidate) => (
                  <option
                    key={candidate.id}
                    value={candidate.id}
                    disabled={candidate.id === rightId}
                  >
                    {candidate.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Second item
              <select value={rightId} onChange={(event) => onRightChange(event.target.value)}>
                <option value="">Choose a version or test</option>
                {candidates.map((candidate) => (
                  <option
                    key={candidate.id}
                    value={candidate.id}
                    disabled={candidate.id === leftId}
                  >
                    {candidate.label}
                  </option>
                ))}
              </select>
            </label>
          </section>
          {(!left || !right) && (
            <EmptyState title={left || right ? 'Choose one more item' : 'Choose two items'}>
              Versions show package evidence; test runs add output, assertions, and usage when
              available.
            </EmptyState>
          )}
          {left && right && leftRows && rightRows && (
            <section className="panel comparison" aria-label="Skill comparison">
              <div className="comparison-row comparison-header">
                <span>Evidence</span>
                <strong>{left.label}</strong>
                <strong>{right.label}</strong>
              </div>
              {rows.map(([key, label]) => (
                <div className="comparison-row" key={key}>
                  <span>{label}</span>
                  <p>{leftRows[key]}</p>
                  <p>{rightRows[key]}</p>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
