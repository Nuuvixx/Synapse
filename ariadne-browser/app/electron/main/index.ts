
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
// @ts-expect-error (icon asset import)
import icon from '../../resources/icon.png?asset'
import { TabManager } from './TabManager'

function createWindow(): void {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        show: false,
        frame: false, // Frameless window
        autoHideMenuBar: true,
        titleBarStyle: 'hidden', // Inset traffic lights on macOS
        ...(process.platform === 'linux' ? { icon } : {}),
        webPreferences: {
            preload: join(__dirname, '../preload/index.mjs'),
            sandbox: false
        }
    })

    // Initialize TabManager with main window
    const tabManager = TabManager.getInstance()
    tabManager.init(mainWindow)

    // Window Controls IPC
    ipcMain.on('window-minimize', () => mainWindow.minimize())
    ipcMain.on('window-maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize()
        } else {
            mainWindow.maximize()
        }
    })

    // IPC handler for new window from renderer
    ipcMain.handle('open-win', (_, arg: string) => {
        const messageHandlerPath = join(__dirname, '../preload/index.mjs');
        const indexHtml = join(__dirname, '../renderer/index.html');

        const childWindow = new BrowserWindow({
            webPreferences: {
                preload: messageHandlerPath,
                nodeIntegration: true,
                contextIsolation: false,
            },
        })

        if (process.env.VITE_DEV_SERVER_URL) {
            childWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#${arg}`)
        } else {
            childWindow.loadFile(indexHtml, { hash: arg })
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// Add this before app.whenReady()
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, we should focus our window.
        const allWindows = BrowserWindow.getAllWindows();
        if (allWindows.length > 0) {
            const mainWindow = allWindows[0];
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })
}

// Global exception handler
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error)
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.ariadne.browser')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
