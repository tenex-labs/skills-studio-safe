# Headless testing and troubleshooting

Test Lab runs each configuration as its own `claude -p` process. The runner and its limits are
described in [architecture](../architecture.md#test-runs); this page is for when a run goes wrong.

## Try it safely

Pick a small skill, keep **Repository access** on **No tools**, and use a short prompt. Check that:

- output streams into the lane while the status reads `running`;
- the status changes to a final value on its own when the run ends;
- **Cancel** ends the run as `cancelled` within about a second;
- a run appears in `GET /api/studio/test-runs` with its final output after a page reload.

Do not paste the command into a shell to reproduce a run. The runner passes arguments directly and
the prompt on stdin.

## When something fails

| Symptom                               | Likely cause and fix                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| "Claude account required"             | The CLI is missing or signed out. Install it or run `claude auth login`, then reload.                       |
| Run fails with an expired OAuth token | `claude auth status` can report an account whose token expired. Use **Re-authenticate Claude** in Test Lab. |
| `timed-out`                           | The task needs more time or turns. Raise the limits under **Advanced settings**, or narrow the prompt.      |
| `failed` after the turn limit warning | The model kept going past the turn limit. Raise **Turns** or tighten the skill.                             |
| Status stuck on `running`             | The API server stopped mid-run. Restart it; the run becomes `interrupted`.                                  |
| Assertions fail on a `passed` run     | Expected. Status is about the process; assertions are about the output. Check the expected phrases.         |
| Project skill missing from Skill list | The project is not trusted, or the skill is invalid. Trust the project in Library and check its findings.   |

Automated tests use a fake Claude process. Real `claude -p` runs are manual because they depend on
your account, network, model behavior, and usage limits.
