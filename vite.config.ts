import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Read .env.local directly off disk.
 *
 * Vite deliberately lets real environment variables win over .env files.
 * That is normally sensible, but it means a stale machine-wide
 * VITE_SUPABASE_URL left behind by an unrelated project silently overrides
 * this project's credentials — the app then points at the wrong database
 * with no visible clue.
 *
 * Reading the file ourselves and pinning the values via `define` makes
 * .env.local authoritative for local development.
 */
function readLocalEnv(file: string): Record<string, string> {
  const full = path.resolve(__dirname, file)
  if (!fs.existsSync(full)) return {}

  const out: Record<string, string> = {}
  for (const line of fs.readFileSync(full, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key.startsWith('VITE_')) out[key] = value
  }
  return out
}

const localEnv = readLocalEnv('.env.local')

// Only pin what the file actually defines. On Vercel there is no .env.local,
// so the platform's own environment variables are used as normal.
const pinned = Object.fromEntries(
  Object.entries(localEnv).map(([key, value]) => [
    `import.meta.env.${key}`,
    JSON.stringify(value),
  ]),
)

if (Object.keys(pinned).length > 0) {
  const host = localEnv.VITE_SUPABASE_URL?.replace(/^https?:\/\//, '') ?? '(unset)'
  // Printed on every dev start so a wrong project is obvious immediately.
  console.log(`\n  ▸ Supabase project: ${host}\n`)
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: pinned,
  css: {
    // Tailwind v4 runs through its own Vite plugin, so no PostCSS pipeline is
    // needed. Declaring it empty also stops Vite walking up the directory tree
    // and picking up an unrelated postcss.config.js from the home folder.
    postcss: { plugins: [] },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Web Serial and getUserMedia require a secure context.
    // localhost counts as secure, so plain HTTP is fine in dev.
  },
})
