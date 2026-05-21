import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { alphaTab } from '@coderline/alphatab-vite'
import fs from 'node:fs/promises'
import path from 'node:path'

const TAB_EXTS = new Set([
  '.gp', '.gp3', '.gp4', '.gp5', '.gpx', '.xml', '.musicxml',
])

function parseFilename(filename) {
  const ext = path.extname(filename)
  let base = path.basename(filename, ext)
  // Strip trailing parenthesized content: "(ver 2 by emad)"
  base = base.replace(/\s*\([^)]*\)\s*$/, '').trim()
  // Strip trailing dates: "-05-15-2026", "-2026-05-15", "-2026"
  base = base.replace(/[-_\s]+\d{1,2}[-_\s]\d{1,2}[-_\s]\d{2,4}$/, '').trim()
  base = base.replace(/[-_\s]+\d{4}[-_\s]\d{1,2}[-_\s]\d{1,2}$/, '').trim()
  base = base.replace(/[-_\s]+\d{4}$/, '').trim()

  // Prefer " - " (space-hyphen-space) as artist/title separator.
  let dashIdx = base.indexOf(' - ')
  let sepLen = 3
  if (dashIdx < 0) {
    // Fallback to a bare hyphen.
    dashIdx = base.indexOf('-')
    sepLen = 1
  }
  if (dashIdx > 0) {
    return {
      artist: base.slice(0, dashIdx).trim() || 'Unknown',
      title: base.slice(dashIdx + sepLen).trim() || base,
    }
  }
  return { artist: 'Unknown', title: base }
}

async function buildTabsManifest(tabsDir) {
  let entries
  try {
    entries = await fs.readdir(tabsDir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isFile() && TAB_EXTS.has(path.extname(e.name).toLowerCase()))
    .map((e) => {
      const { artist, title } = parseFilename(e.name)
      return {
        id: e.name,
        artist,
        title,
        file: `/tabs/${encodeURIComponent(e.name)}`,
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}

function tabsIndexPlugin() {
  const tabsDir = fileURLToPath(new URL('./public/tabs', import.meta.url))
  return {
    name: 'tabs-index',
    configureServer(server) {
      server.middlewares.use('/tabs/index.json', async (req, res, next) => {
        try {
          const tabs = await buildTabsManifest(tabsDir)
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(tabs))
        } catch (err) {
          next(err)
        }
      })
    },
    async generateBundle() {
      const tabs = await buildTabsManifest(tabsDir)
      this.emitFile({
        type: 'asset',
        fileName: 'tabs/index.json',
        source: JSON.stringify(tabs, null, 2),
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), alphaTab(), tabsIndexPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
