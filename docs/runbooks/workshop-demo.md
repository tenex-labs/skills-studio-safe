# Workshop demo

A ten-minute walk through the app, from discovery to comparing two configurations.

## Before you start

```bash
npm install
npm run dev
```

Prepare a disposable project folder whose `.claude/skills/` contains a skill with the same name as
one of your personal skills. Confirm `claude` is signed in.

## Flow

1. **Library:** show personal skills. Switch to **Project**, choose the prepared folder with
   **Choose project folder**, and point out that nothing was scanned before you trusted it.
2. **Precedence:** find the same-name skill. The project copy is marked shadowed because Claude
   Code uses the personal skill.
3. **Editor:** open a skill, change a line, preview it, and save. Show the new entry in the
   version timeline, then show that the installed `SKILL.md` is unchanged.
4. **Test Lab:** choose the skill and write a prompt you would really give Claude.
5. **Compare:** give Configuration A the saved version and Configuration B the filesystem
   baseline, or vary the model. Click **Run both** and watch the output stream.
6. **Evidence:** read the aligned table: status, duration, tokens, and cost. Open **Trace details**
   to show the live events, and point out that they are not saved.
7. **Extension:** assign one exercise from [`../../challenges/`](../../challenges/).

## What to point out

- Untrusted projects are never read.
- Drafts, installed files, live traces, and saved runs are labeled differently.
- Test runs use the attendee's own Claude sign-in and have no tools by default.

## If a live run is not possible

Stop the API server and reload. The UI switches to a labeled demo catalog whose runs are simulated,
so you can still demonstrate the comparison table.

## Cleanup

Cancel active runs and stop the dev server. To stop scanning the disposable project, select it in
Library and choose **Forget project**.
