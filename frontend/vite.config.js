import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const versionFile = JSON.parse(readFileSync(resolve(__dirname, '../version.json'), 'utf-8'))

export default defineConfig({
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(versionFile.version),
        __APP_CODENAME__: JSON.stringify(versionFile.codename),
        __APP_RELEASE_DATE__: JSON.stringify(versionFile.releaseDate),
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
})
