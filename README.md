# Cairn

A personal task and goal tracker that shows what you've done, and never something to chase.

> **Working name.** The name is not final.

Live at **https://cairn.lewis.is**. Installable on an iPhone (Add to Home Screen) and works offline.

## What it is

An installable web app (a PWA). Everything you log stays in your own browser; there is no server and
no account. It deliberately has no due dates, no "overdue", no streaks to lose, no badges or levels,
and never shows a failure.

- **This week:** a ring per area (goals met, plus a thin outer ring for extra effort outside your
  goals), every goal for the week in one list, a bead for each win finished this week, a timer, one
  row to log or time a repeatable task, and a plain to-do list.
- **Goals:** time, count and amount goals, **routines** (a goal made of repeatable tasks, such as
  chores), overarching goals, daily, weekly or monthly, with archiving that keeps history.
- **History:** week, month, year and custom ranges, a calendar heatmap, goal history that never shows
  a miss, time by area, and a full log where any entry can be fixed or deleted.
- **Backup:** export and import a JSON file from Manage. A version card there shows which build you
  are running and can fetch the newest.

## Develop

```sh
npm ci
npm run dev        # local dev server
npm test           # unit tests
npm run test:tz    # the same tests in several time zones
npm run lint
npm run build      # type-check, build, and write the offline file list and version
```

Vite, React, TypeScript, Recharts for charts, Vitest for tests. Pushes to `main` build and deploy to
GitHub Pages automatically.

## Documentation

| | |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Rules and working agreement for an AI session (read automatically by Claude Code) |
| [docs/HANDOFF.md](docs/HANDOFF.md) | **Start here on a new machine:** setup, git identity, GitHub login, releasing and versioning, hosting, testing, open items |
| [docs/BEHAVIOUR.md](docs/BEHAVIOUR.md) | The screens, the design rules and how each interaction behaves |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | The records, goal math, rings, storage and safety |
| [deploy/README.md](deploy/README.md) | Hosting on a NAS instead (not in use) |

## Licence

Copyright (c) 2026 CerebralTag. **All rights reserved.** The code is public to read, but it is not
licensed for use or reuse; see [LICENSE](LICENSE). Third-party packages keep their own licences; see
[THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt).
