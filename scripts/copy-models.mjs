/**
 * Copy the face models we actually use from node_modules into public/models.
 *
 * They are not committed (about 13 MB), and they are not fetched from a CDN
 * either — hospital internet is unreliable, and a kiosk that cannot load its
 * models mid-shift is a kiosk that stops working. Copying at build time means
 * they ship with the deployment and are cached by the browser thereafter.
 *
 * Runs automatically on `npm install` and before every build.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'node_modules', '@vladmandic', 'human', 'models')
const target = join(root, 'public', 'models')

// Only what the face pipeline needs. The full folder is 28 MB; this is ~13 MB.
const MODELS = [
  'blazeface', // face detection
  'facemesh', // landmarks, used for alignment and angle checks
  'faceres', // the 1024-d descriptor — this is the actual recognition model
  'antispoof', // rejects photos and screens
  'liveness', // rejects still images
  'iris', // gaze, improves angle estimation during enrolment
]

if (!existsSync(source)) {
  console.warn('[copy-models] @vladmandic/human not installed yet — skipping.')
  process.exit(0)
}

mkdirSync(target, { recursive: true })

let copied = 0
let bytes = 0

for (const name of readdirSync(source)) {
  const base = name.replace(/\.(json|bin)$/, '')
  if (!MODELS.includes(base)) continue

  const from = join(source, name)
  const to = join(target, name)

  // Skip files already present and identical in size — keeps rebuilds quick.
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue

  copyFileSync(from, to)
  copied += 1
  bytes += statSync(from).size
}

if (copied > 0) {
  console.log(
    `[copy-models] copied ${copied} files (${(bytes / 1024 / 1024).toFixed(1)} MB) to public/models`,
  )
}
