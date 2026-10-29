# Cairn: instructions for an AI session

A personal task and goal tracker whose job is to make its user feel accomplished, not stressed. The
user does a lot but often feels unaccomplished; the app shows progress and a history of wins.
Live at https://cairn.lewis.is (working name "Cairn"). Vite + React + TypeScript, an installable PWA
for iPhone and laptop, data in the browser's localStorage (no server, no account).

**If you are picking this up on a new machine, read [docs/HANDOFF.md](docs/HANDOFF.md) first** (setup,
git identity, GitHub login, releasing, hosting, testing, open items). Then
[docs/BEHAVIOUR.md](docs/BEHAVIOUR.md) (screens and rules) and [docs/DATA-MODEL.md](docs/DATA-MODEL.md)
(records and goal math) when you touch those areas.

## Hard rules (the user's decisions)

- **No due dates, no "overdue", no backlog-by-age views.** Tasks are just to do / done.
- **Never show failure.** Goal history is neutral: every period is a bar, hits get a check, below-target
  periods get no mark (no red, no "missed"). Partial credit counts. Prefer best stretches to streaks.
- **Show what is done, never something to chase.** No badges, milestones, XP, levels or "next milestone".
- **Never show a zero** on the week screen ("3h" until something is done, then "45m of 3h").
- **No units or measures.** An amount is a plain number. **Areas are broad labels**, not granular.
- Every colour is a CSS variable ([src/index.css](src/index.css)); keep the 7-colour area palette's order.
- The bottom bar stays at three items: This week, History, Manage.

## How to work

- **The priority is a working app the user uses.** You write the code, in small commits the user can
  follow, and walk them through what is worth understanding. Keep answers short and direct.
- **"Feedback?" or "no changes" means discuss, do not build.** "Verify" means check and report. Build
  when told to. Say what you could not check (anything on a real iPhone).
- **Commits** end with `Assisted-by: Claude:<model-id>`, never `Co-Authored-By`; no "Generated with
  Claude Code" line on PRs. Commit with the repo-local identity `CerebralTag` /
  `CerebralTag@users.noreply.github.com` (set it in every new clone).
- **Push finished, checked work to `main` without asking each time**; the site deploys from it and the
  user tests there. Ask before any *other* GitHub change (settings, visibility, DNS, workflow permissions).
- **Versions are CalVer git tags** (`YYYY.MM.DD`; `b`, `c` for a second release that day, only when
  asked). The screen shows `git describe --tags --always --dirty`. Tag the **first push of each new
  local day** with that day's date and push the tag with it; do not tag other pushes.
- Before pushing: `npx tsc -b && npm run lint && npm test && npm run test:tz && npm run build`, and look
  at UI changes in a browser at phone width. Details and commands are in HANDOFF.md.
- Personal notes about the user are kept out of this public repo (in Claude's per-machine memory).

## Where things are

`src/types.ts` the records. Pure logic (all unit tested): `goals.ts` goal math and each-goal helpers,
`reports.ts` ranges, totals and charts' data, `todayAreas.ts` rings and the week's goal list,
`order.ts` goal and area order, `goalTap.ts` tapping a goal, `quickWins.ts` repeatable tasks,
`timer.ts`, `edits.ts`, `manage.ts` (archive, remove), `suggest.ts` names, `areaGoals.ts`,
`beads.ts`, `serialize.ts` (validation and the stored format), `storage.ts`, `backup.ts`,
`buildInfo.ts` (version and updates), `limits.ts`, `dates.ts`. UI in `src/components/` and
`src/App.tsx` (holds all state and the handlers). The service worker is `public/sw.js`; the build
(`vite.config.ts`) stamps the version and writes its precache list. `deploy/` and `scripts/deploy.sh`
are the unused NAS option.

## Data safety rules (keep these true)

- **Never write data the loader would refuse.** `saveData` goes through `serializeChecked`;
  `deserialize` validates every field. A new field needs its check and a round-trip test.
- A failed save rolls the screen back to what is stored, with a calm notice. Unreadable stored data
  shows the recovery screen and is never overwritten.
- Results are always calculated from records, never stored. Editing a goal's areas or an entry's links
  changes how past weeks look; target history (`targets[]`) keeps old periods on their old target.
- Archive, do not delete. A backup replaces everything, so show a summary first.
- GitHub Pages sends `cache-control: max-age=600`, so the service worker must revalidate navigations and
  bypass the HTTP cache when precaching (see HANDOFF.md section 4). Run `npm run test:tz` when touching dates.

## Status and open items

The app is built and in daily use. The list of open items and ideas (iPhone checks still to do, the
outer ring's lap length, an automatic day tag, deferred features) is in HANDOFF.md section 8.
