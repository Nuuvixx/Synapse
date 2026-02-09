import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: {
            lib: {
                entry: resolve(__dirname, 'electron/main/index.ts')
            }
        }
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            lib: {
                entry: resolve(__dirname, 'electron/preload/index.ts')
            }
        }
    },
    renderer: {
        root: resolve(__dirname, 'renderer'),
        build: {
            rollupOptions: {
                input: resolve(__dirname, 'renderer/index.html')
            }
        },
        resolve: {
            alias: {
                '@': resolve(__dirname, 'renderer/src')
            }
        },
        plugins: [react()]
    }
})
