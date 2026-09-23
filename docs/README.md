# Documentation

| Document                          | Read it to learn                                                 |
| --------------------------------- | ---------------------------------------------------------------- |
| [Architecture](architecture.md)   | How data flows, who owns it, and how a test run works            |
| [Conventions](conventions.md)     | The coding rules for this repository                             |
| [Run event model](event-model.md) | The SSE trace contract and what a run saves                      |
| [Privacy](privacy.md)             | What leaves your machine, what stays, and what a test run can do |

## Runbooks

| Runbook                                                       | Use it to                                        |
| ------------------------------------------------------------- | ------------------------------------------------ |
| [Local development](runbooks/local-development.md)            | Install, run, verify, and reset local data       |
| [Headless testing](runbooks/headless-testing.md)              | Diagnose a Test Lab run that fails or hangs      |
| [Database backup and recovery](runbooks/database-recovery.md) | Back up, restore, or recover the SQLite database |
| [Workshop demo](runbooks/workshop-demo.md)                    | Present the app end to end                       |

## Challenges

Each file in [`../challenges/`](../challenges/) is a self-contained, roughly 20-minute exercise:
add a validator rule, add output checks to Test Lab, clarify precedence conflicts, improve accessibility,
or design your own slice.
