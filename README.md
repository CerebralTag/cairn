# Cairn

A personal task and goal tracker that shows what you've done, and never something to chase.

> **Working name.** The name is not final.

## What it is
An installable web app (a PWA) for iPhone and laptop. Everything you log stays in your own
browser; there is no server and no account.

- **Today:** a bead for every win finished today, goal rings (daily, weekly or monthly), a timer,
  one-tap quick wins, and a plain to-do list.
- **History:** week, month, year and custom ranges, a calendar heatmap, goal history that never
  shows a miss, time by area, and a full log where any entry can be fixed or deleted.
- **Goals:** time, count and amount goals, overarching goals, and archiving that keeps history.
- **Backup:** export and import a JSON file. The app works offline once installed.

It deliberately has no due dates, no "overdue", no streaks to lose, and no badges or levels.
See [CLAUDE.md](CLAUDE.md) for the design rules and data model.

## Tech
Vite, React and TypeScript. Charts by Recharts. The tests are Vitest.

## Develop
```sh
npm install
npm run dev        # local dev server
npm test           # unit tests
npm run test:tz    # the same tests in several time zones
npm run lint
npm run build      # type-check, build, and generate the offline file list
```

## Licence
Copyright (c) 2026 CerebralTag. **All rights reserved.** The code is public to read, but it is
not licensed for use or reuse; see [LICENSE](LICENSE). Third-party packages keep their own
licences; see [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt).
