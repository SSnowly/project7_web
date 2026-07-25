/**
 * Generates src/data/items-data.json by scanning image folders.
 *
 * Usage:
 *   node scripts/build-items.mjs
 *
 * Expected image layout:
 *   public/images/fivem/<category>/<name>.png  (or .webp/.jpg)
 *   public/images/redm/<category>/<name>.png
 *
 * The existing Next.js images can be bulk-copied:
 *   Copy-Item -Recurse ..\project7_web\public\images\* .\public\images\fivem\
 *
 * New GitHub sources:
 *   Griefa/gfa-items         -> public/images/fivem/gfa/
 *   TankieTwitch FREE FiveM  -> public/images/fivem/tankie/
 *   TankieTwitch FREE RedM   -> public/images/redm/<their-subfolders>/
 */

import { readdirSync, statSync, mkdirSync, writeFileSync } from 'fs'
import { join, parse, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const IMAGES_DIR = join(ROOT, 'public', 'images')
const OUT = join(ROOT, 'src', 'data', 'items-data.json')

const IMAGE_EXT = /\.(png|jpg|jpeg|webp|gif)$/i

function toLabel(name) {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function scanDir(dir, game, gameRoot, items = []) {
  const entries = readdirSync(dir)
  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      scanDir(fullPath, game, gameRoot, items)
    } else if (IMAGE_EXT.test(entry)) {
      // All folder segments between game root and file are categories
      const relDir = dir.replace(gameRoot, '').replace(/^[\\/]/, '')
      const segments = relDir.split(/[\\/]/).filter(Boolean).map(s => s.toLowerCase())
      const name = parse(entry).name.toLowerCase()
      const relPath = fullPath.replace(join(IMAGES_DIR, game), '').replace(/\\/g, '/')
      items.push({
        id: `${game}_${segments.join('_')}_${name}`,
        name,
        label: toLabel(name),
        categories: segments.length > 0 ? segments : ['other'],
        game,
        image: `/images/${game}${relPath}`
      })
    }
  }
  return items
}

function scanGame(game) {
  const gameDir = join(IMAGES_DIR, game)
  try {
    return scanDir(gameDir, game, gameDir)
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`Error scanning ${gameDir}:`, err.message)
    else console.warn(`[skip] ${gameDir} does not exist yet`)
    return []
  }
}

const items = [...scanGame('fivem'), ...scanGame('redm')]
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(items, null, 2))
console.log(`✓ Written ${items.length} items to src/data/items-data.json`)
console.log(`  FiveM: ${items.filter(i => i.game === 'fivem').length}`)
console.log(`  RedM:  ${items.filter(i => i.game === 'redm').length}`)
