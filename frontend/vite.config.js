import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Read version safely — falls back if file not found (e.g. on Render CI)
let appVersion = '1.0.0', appCodename = 'Archon', appReleaseDate = '2026-03-01'
try {
    const { readFileSync } = await import('fs')
    const { resolve, dirname } = await import('path')
    const { fileURLToPath } = await import('url')
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const vf = JSON.parse(readFileSync(resolve(__dirname, '../version.json'), 'utf-8'))
    appVersion = vf.version || appVersion
    appCodename = vf.codename || appCodename
    appReleaseDate = vf.releaseDate || appReleaseDate
} catch { /* version.json not found — use defaults */ }

export default defineConfig({
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(appVersion),
        __APP_CODENAME__: JSON.stringify(appCodename),
        __APP_RELEASE_DATE__: JSON.stringify(appReleaseDate),
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'https://archon-backend-wvml.onrender.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
})
