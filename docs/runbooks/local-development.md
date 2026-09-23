# Local development

## Run it

```bash
npm install
npm run dev
```

This starts the API on `127.0.0.1:4319` and the UI on `http://localhost:4320`. Vite proxies
`/api` to the API. Both ports are fixed: if either is taken, another Studio instance is probably
still running, so stop it first.

Before handing off a change, run `npm run preflight`. It checks formatting, lint, and types, then
runs every test and a production build.

## Check the main paths by hand

- Library lists your personal skills and no project skills until you trust a project.
- A skill with the same name in both scopes shows the project copy as shadowed.
- Saving in Editor adds a version but leaves the installed `SKILL.md` unchanged.
- A Test Lab run streams output, ends with a final status, and survives a page reload in
  `GET /api/studio/test-runs`.
- With the API stopped, the UI shows the labeled demo catalog and can still run demo tests.

## Reset local data

Stop the app first. Studio keeps all of its state in one SQLite database (see
[privacy](../privacy.md) for the path per platform). To start fresh, back it up if you need it,
then delete that folder. Your installed skills are not in it and are not affected.

Never commit the database, backups, or test output.
