import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Which version of the code this is, stamped at build time. Releases are CalVer git tags
// (YYYY.MM.DD, then 2026.10.21b, c, ... for same-day follow-ups). `git describe` gives the tag
// itself on a tagged commit, `<tag>-<N>-g<sha>` N commits past it, `-dirty` if there are
// uncommitted changes, and just the sha if no tag exists. Shown in Manage.
function git(command: string): string | null {
  try {
    return execSync(`git ${command}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return null
  }
}
const BUILD_INFO = {
  version: git('describe --tags --always --dirty') ?? 'unknown',
  builtAt: new Date().toISOString(),
}

// After a production build, list every file that was produced and write that list,
// plus a fingerprint of the whole build, into dist/sw.js. The service worker then
// caches the full app on install (so the first launch works offline) and names its
// cache after the build (so the previous build's files are removed).
function precachePlugin(): Plugin {
  let outDir = 'dist'
  return {
    name: 'cairn-precache',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const walk = (dir: string, prefix = ''): string[] =>
        readdirSync(dir).flatMap((name) => {
          const full = path.join(dir, name)
          return statSync(full).isDirectory() ? walk(full, `${prefix}${name}/`) : [`${prefix}${name}`]
        })

      // version.json says which build is live. It is written after the list is made, never cached
      // by the service worker, and fetched fresh by the "Check for updates" button.
      const files = walk(outDir)
        .filter((file) => file !== 'sw.js' && file !== 'version.json')
        .sort()
      const hash = createHash('sha1')
      for (const file of files) hash.update(file).update(readFileSync(path.join(outDir, file)))
      const build = hash.digest('hex').slice(0, 10)

      // `commit` is only for older builds still in people's browsers (they read that name), so
      // their "Check for updates" keeps working; the app itself reads `version`.
      writeFileSync(path.join(outDir, 'version.json'), JSON.stringify({ ...BUILD_INFO, commit: git('rev-parse --short HEAD') ?? 'unknown' }))
      const swPath = path.join(outDir, 'sw.js')
      const sw = readFileSync(swPath, 'utf8')
        .replace("const BUILD = 'dev'", `const BUILD = '${build}'`)
        .replace('const PRECACHE = [] /* BUILD: replaced with the list of files in the build */', `const PRECACHE = ${JSON.stringify(['./', ...files.map((f) => `./${f}`)])}`)
      if (!sw.includes(`'${build}'`)) throw new Error('precache: could not fill in sw.js')
      writeFileSync(swPath, sw)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), precachePlugin()],
  define: { __BUILD_INFO__: JSON.stringify(BUILD_INFO) },
  // Relative URLs, so the built app works from any address or sub-folder
  // (a custom domain, or username.github.io/cairn/) without further config.
  base: './',
})
