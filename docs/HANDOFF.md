# Handoff: working on Cairn from a new machine

Read this first if you are a fresh session (or person) picking the project up. The other docs:
[../README.md](../README.md) (overview), [../CLAUDE.md](../CLAUDE.md) (rules for an AI session),
[BEHAVIOUR.md](BEHAVIOUR.md) (screens and rules), [DATA-MODEL.md](DATA-MODEL.md) (records and goal math).

**What lives only on the original laptop, not in the repo:** Claude's per-machine memory notes, the
GitHub login, local git settings, and scratch scripts for browser checks. Everything you need from them
is written below.

## 1. Set up the machine

```sh
git clone https://github.com/CerebralTag/cairn.git && cd cairn
node --version        # 22 or newer (the deploy builds with 22)
npm ci
npm test && npm run lint && npx tsc -b      # all should pass before you change anything
```

**Git identity: set it in the clone, not globally.** A fresh clone has none of the original's
settings, and the machine's global email may be personal. Every commit in the public repo must use
the no-reply address:

```sh
git config user.name  CerebralTag
git config user.email CerebralTag@users.noreply.github.com
```

**Pushing needs a GitHub login the user approves** (a device code at https://github.com/login/device):

```sh
gh auth login -h github.com -p https -w -s repo,workflow
```

Push without changing global git config by supplying `gh` as a one-off credential helper:

```sh
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main
```

When the work on a machine is finished, remove "GitHub CLI" at https://github.com/settings/applications
to revoke the token. (Worth also having "Block command line pushes that expose my email" switched on in
GitHub's email settings.)

## 2. Working agreement with the user

- **The priority is a working app the user actually uses.** Claude writes the code in small commits,
  and walks through the parts worth understanding (data model, goal math, reporting, saving). The user is
  an experienced developer who is new to JavaScript; explain React/TypeScript by contrast with C# or
  Java only when asked. **Keep answers short and direct.**
- **"Feedback?" or "no changes" means discuss, do not build.** Give an opinion with a recommendation
  and the real decisions. "Verify" means check and report, changing nothing. Build when told to
  ("go ahead", "yes", "do it").
- Mockups before big UI changes when the user asks (they review them on a Claude artifact canvas).
- Report outcomes plainly: what changed, what you checked, what you could not check (for example
  anything on a real iPhone), and what the user should look at.
- **Commits** end with `Assisted-by: Claude:<model-id>` (never `Co-Authored-By`), and PR text gets no
  "Generated with Claude Code" line. Small, titled commits.
- **Push finished, checked work to `main` without asking each time**; the live site updates from it
  and the user tests there. Ask before any *other* GitHub change (settings, visibility, DNS, workflow
  permissions, branch rules). Never push a half-done change.

## 3. Releasing

Every push to `main` runs [.github/workflows/pages.yml](../.github/workflows/pages.yml): lint, tests, build,
deploy to GitHub Pages. It takes a minute or two; a failed check means nothing deploys and the old
version stays up.

Before pushing:

```sh
npx tsc -b && npm run lint && npm test && npm run test:tz && npm run build
```

`npm run test:tz` runs the suite in London, New York and Auckland time zones: run it whenever date
logic changes. For any UI change, look at it in a browser at phone width (section 5).

**Versioning.** The version is `git describe --tags --always --dirty`, stamped at build time and shown
in Manage: the bare tag on a tagged commit, `<tag>-<N>-g<sha>` N commits past it, `-dirty` for
uncommitted changes. Tags are CalVer, `YYYY.MM.DD`. **Keep the tag in step with the date:** the first push
of each new local day gets that day's tag, pushed with it; other pushes are untagged. A second tagged
release in one day is `2026.10.29b`, `c`... and only when the user asks.

```sh
git tag 2026.10.29                      # first push of the day only
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main 2026.10.29
curl -s "https://cairn.lewis.is/version.json?t=$(date +%s)"    # confirm what is live (after a minute or two)
```

The deploy checks out the full history (`fetch-depth: 0`); without tags in the checkout the version
would be a bare sha. Tag pushes do not trigger a deploy by themselves; to redeploy a commit without a
change, run the workflow manually (`gh workflow run pages.yml`).

## 4. Hosting, caching and updates

- **Site:** https://cairn.lewis.is, GitHub Pages (source: GitHub Actions), repo
  https://github.com/CerebralTag/cairn (public; all rights reserved, see LICENSE).
- **DNS** (at the user's registrar): a CNAME `cairn` to `cerebraltag.github.io`, and a TXT record
  `_github-pages-challenge-cerebraltag.cairn` that verified the name (keep it). The custom domain is set
  in the repo's Pages settings; "Enforce HTTPS" is on. If a certificate ever stalls, removing and
  re-adding the custom domain restarts it. Namecheap's name servers can answer inconsistently when queried
  directly; check with `dig +trace` or a public resolver.
- **The address owns the data** (localStorage is per origin). Changing the domain starts the app empty:
  export a backup first and import it at the new address.
- **GitHub Pages sends `cache-control: max-age=600` on everything**, and a naive service worker would
  show the previous deploy for up to 10 minutes after each one (reproduced with a local server). So:
  navigations are fetched with `cache: 'no-cache'`, the precache with `cache: 'reload'`, `version.json`
  is never intercepted, and "Update to …" opens the app at a one-off `?fresh=` address that no browser can
  answer from a saved copy (see [public/sw.js](../public/sw.js), [src/buildInfo.ts](../src/buildInfo.ts),
  [vite.config.ts](../vite.config.ts)). The build writes the precache list, cache name and
  `dist/version.json` after bundling.
- **The Manage version card** is how to tell whether a device has an update: it shows the version, the build
  time, the address it was served from and the offline cache it holds. A dev server (`npm run dev`) reads the
  version once at start, so its label goes stale until restarted.
- **Hosting on a NAS instead** is written up in [../deploy/README.md](../deploy/README.md) with
  [../scripts/deploy.sh](../scripts/deploy.sh) (guarded; it deletes files in the destination). Nothing is
  hosted there.

## 5. Testing

- **Unit tests** (Vitest) cover every pure module: goal math, reports, serialization, edits, ordering,
  rings, suggestions, timers, versions. Each new field needs its check in
  [src/serialize.ts](../src/serialize.ts) and a round-trip test. [src/testHelpers.ts](../src/testHelpers.ts)
  has builders (`data`, `doneWin`, `todo`, `session`, sample goals).
- **Browser checks** are not in the repo. The recipe that worked: in a scratch folder `npm i playwright`,
  run `npm run dev` (or `npm run build && npm run preview`), then drive a 390x844 page. Seed state with
  `page.addInitScript` that sets `localStorage['cairn.data']` once (guard it with a `sessionStorage` flag,
  or the app overwrites the seed on its first save); the data is a version-2 backup file, so exporting one
  from the app is the easiest seed. To pretend it is another day use `page.clock.setFixedTime`.
- **Independent review** worked well for larger changes: have a separate reviewer model read the diff,
  run the checks and try to break it. It caught real bugs (a Routine's past weeks changing when tasks were
  added, a timer's win landing in the wrong week, an edit silently dropping minutes).
- A local server that sends `cache-control: max-age=600` reproduces GitHub Pages' caching; use one
  before trusting any change to the service worker.

## 6. Safety rules to keep true

- **Never write data the loader would refuse** (`serializeChecked`); if saving fails the screen rolls
  back to what is stored and shows a calm notice; unreadable stored data shows the recovery screen and is
  never overwritten.
- A backup replaces everything, so it shows a summary first; importing keeps a running timer.
- Archive rather than delete; delete only from the Archived list.
- The tag, the version and `version.json` must agree, and `commit` stays in `version.json` for old
  builds still in browsers.

## 7. Gotchas learned

- macOS: `sed -i` needs `sed -i ''`; zsh errors on an unquoted `--include=*.ts` glob.
- A repeatable tap has a 700 ms double-tap guard, so scripted taps on the same task need a pause.
- A new day with no new tag shows the old day's tag plus a count (`2026.10.21-13-g9ab52fe` built on 26 Oct), which looks like a stale version. Tag the first push of each day.
- Temporary folders get cleaned over time; do not keep anything you need only in a scratch directory.
- The legacy-format migration code ([src/migrate.ts](../src/migrate.ts)) is kept but not maintained.

## 8. Open items and ideas

- Not yet checked on a real iPhone: how the service-worker update behaves in the Home Screen app, how
  the "I did something" form scrolls into view when opened from a goal tap, and ring sizes at four areas.
- The outer ring's lap is 4 hours (`EXTRA_LAP_MINUTES`); the user may want to change it.
- "Time by area · this week" on the week screen overlaps the outer ring; the user has not decided.
- Let the deploy create the day's tag itself (needs `contents: write` on the workflow; ask first).
- Deferred: pin favourite repeatable tasks, dark mode, code splitting (the bundle is over 500 kB),
  a bigger tap target for the Year heatmap, Supabase sync (`src/storage.ts` is the seam) and an
  automatic backup.
- "Cairn" is a working name.
