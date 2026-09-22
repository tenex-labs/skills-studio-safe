# Workshop demo

This flow presents Claude Skill Studio from discovery through promotion.

## Start

```bash
npm install
npm run dev
```

## Demo flow

1. **Library:** show personal skills, then explicitly trust a prepared demo project and rescan.
2. **Precedence:** open a same-name conflict and explain why the personal version wins.
3. **Editor:** change a draft, run validation, and prove the installed file is unchanged.
4. **Test Lab:** choose a preset and immutable version, run a bounded no-tools test, and distinguish
   partial SSE trace from the final result.
5. **Save:** save a completed result and explain its version/test provenance.
6. **Compare:** compare two saved results and inspect assertion differences.
7. **Promote:** preview scope and promote the approved draft; rescan to show the filesystem as
   installed authority.
8. **Extension:** assign one exercise from [`../../challenges/`](../../challenges/).

## Proof points

- Untrusted projects are neither scanned nor modified.
- Draft, installed file, immutable version, active trace, and saved result are visibly distinct.
- Claude authentication remains owned by the CLI and tools remain disabled.
- The personal winner is explicit; the project skill is not overwritten or merged.

## Demo fallback

Prepare fictional fixture skills and saved results. If Claude authentication, network, or usage
limits block a live run, use the fake runner and clearly label it. If promotion fails, keep the
draft and show the atomic-write error; do not edit the file manually during the demo.

## Cleanup

Cancel active runs, stop the dev process, untrust the disposable demo project if the UI supports it,
and remove only demo application data after backing up anything needed. Do not delete personal
skills or a participant's database.
