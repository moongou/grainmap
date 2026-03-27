import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import Database from './database'
import fs from 'fs'
import crypto from 'crypto'
import archiver from 'archiver'
import extract from 'extract-zip'

let store: any
let db: Database

// Register custom protocol for local images
protocol.registerSchemesAsPrivileged([
  { scheme: 'app-data', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
])

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true, // Keep secure but use custom protocol
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  })

  // Determine if we're in development or production
  const isDev = process.env.VITE_DEV_SERVER_URL || !app.isPackaged

  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    mainWindow.loadURL(url)
    mainWindow.webContents.openDevTools()
  } else {
    const appPath = app.getAppPath()
    const possiblePaths = [
      path.join(appPath, 'dist/index.html'),
      path.join(appPath, '../dist/index.html'),
      path.join(__dirname, '../dist/index.html')
    ]

    let found = false
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        mainWindow.loadFile(p)
        found = true
        break
      }
    }

    if (!found) {
      mainWindow.loadFile(path.join(process.cwd(), 'dist/index.html'))
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

app.whenReady().then(async () => {
  const { default: Store } = await (eval('import("electron-store")') as Promise<any>)
  store = new Store()

  db = new Database()
  db.init()

  // Handle app-data protocol
  protocol.handle('app-data', (request) => {
    const url = request.url.slice('app-data://'.length)
    const filePath = path.join(app.getPath('userData'), url)
    return net.fetch(pathToFileURL(filePath).toString())
  })

  // Database IPC handlers
  ipcMain.handle('db:init', async () => {
    return db.init()
  })

  ipcMain.handle('db:createUser', async (_, user: any) => {
    return db.createUser(user)
  })

  ipcMain.handle('db:getUser', async (_, username: string) => {
    return db.getUser(username)
  })

  ipcMain.handle('db:validateUser', async (_, username, password) => {
    return db.validateUser(username, password)
  })

  ipcMain.handle('db:createPhoto', async (_, photo: any) => {
    return db.createPhoto(photo)
  })

  ipcMain.handle('db:getPhotosByUser', async (_, userId: string) => {
    return db.getPhotosByUser(userId)
  })

  ipcMain.handle('db:updatePhoto', async (_, id: string, photo: any) => {
    return db.updatePhoto(id, photo)
  })

  ipcMain.handle('db:deletePhoto', async (_, id: string) => {
    return db.deletePhoto(id)
  })

  ipcMain.handle('db:saveAIConfig', async (_, userId: string, config: any) => {
    return db.saveAIConfig(userId, config)
  })

  ipcMain.handle('db:getAIConfig', async (_, userId: string) => {
    return db.getAIConfig(userId)
  })

  // File operations
  ipcMain.handle('file:selectImage', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
      ],
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      const buffer = fs.readFileSync(filePath)
      const base64 = buffer.toString('base64')
      const ext = path.extname(filePath).toLowerCase()
      const mimeType = ext === '.png' ? 'image/png' :
                       ext === '.gif' ? 'image/gif' :
                       ext === '.webp' ? 'image/webp' : 'image/jpeg'

      return {
        path: filePath,
        data: `data:${mimeType};base64,${base64}`,
        name: path.basename(filePath),
      }
    }
    return null
  })

  ipcMain.handle('file:saveImage', async (_, imageData: string, userId: string) => {
    const userDataPath = path.join(app.getPath('userData'), 'photos', userId)
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true })
    }

    const photoId = crypto.randomUUID()
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const fileName = `${photoId}.jpg`
    const filePath = path.join(userDataPath, fileName)

    fs.writeFileSync(filePath, buffer)

    return {
      id: photoId,
      path: `app-data://photos/${userId}/${fileName}`, // Use custom protocol
      absolutePath: filePath,
    }
  })

  ipcMain.handle('file:deleteImage', async (_, filePath: string) => {
    try {
      let absolutePath = filePath
      if (filePath.startsWith('app-data://')) {
        absolutePath = path.join(app.getPath('userData'), filePath.slice('app-data://'.length))
      }

      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath)
      }
      return true
    } catch (error) {
      console.error('Delete image error:', error)
      return false
    }
  })

  ipcMain.handle('file:exportData', async (_, data: any) => {
    const result = await dialog.showSaveDialog({
      defaultPath: `grainmap-export-${new Date().toISOString().split('T')[0]}.gmap`,
      filters: [{ name: 'Grainmap Export', extensions: ['gmap'] }],
    })

    if (result.canceled) return false

    const exportFilePath = result.filePath
    const output = fs.createWriteStream(exportFilePath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    return new Promise((resolve, reject) => {
      output.on('close', () => resolve(true))
      archive.on('error', (err: Error) => reject(err))

      archive.pipe(output)
      archive.append(JSON.stringify(data, null, 2), { name: 'data.json' })

      if (data.photos && Array.isArray(data.photos)) {
        for (const photo of data.photos) {
          let photoPath = photo.imagePath
          if (photoPath.startsWith('app-data://')) {
            photoPath = path.join(app.getPath('userData'), photoPath.slice('app-data://'.length))
          }

          if (fs.existsSync(photoPath)) {
            const fileName = path.basename(photoPath)
            archive.file(photoPath, { name: `photos/${fileName}` })
          }
        }
      }

      archive.finalize()
    })
  })

  ipcMain.handle('file:importData', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Grainmap Export', extensions: ['gmap'] }],
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const importFilePath = result.filePaths[0]
    const tempDir = path.join(app.getPath('temp'), `grainmap-import-${crypto.randomUUID()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    try {
      await extract(importFilePath, { dir: tempDir })

      const dataPath = path.join(tempDir, 'data.json')
      if (!fs.existsSync(dataPath)) {
        throw new Error('Invalid export file: missing data.json')
      }

      const content = fs.readFileSync(dataPath, 'utf-8')
      const data = JSON.parse(content)

      const photosDir = path.join(tempDir, 'photos')
      if (fs.existsSync(photosDir)) {
        const targetBaseDir = path.join(app.getPath('userData'), 'photos')

        for (const photo of data.photos) {
          const fileName = photo.imagePath.split('/').pop() || `${crypto.randomUUID()}.jpg`
          const srcPath = path.join(photosDir, fileName)

          if (fs.existsSync(srcPath)) {
            const targetDir = path.join(targetBaseDir, 'imported')
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

            const targetPath = path.join(targetDir, fileName)
            fs.copyFileSync(srcPath, targetPath)
            photo.imagePath = `app-data://photos/imported/${fileName}`
          }
        }
      }

      fs.rmSync(tempDir, { recursive: true, force: true })
      return data
    } catch (error) {
      console.error('Import error:', error)
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })
      throw error
    }
  })

  // Store operations for settings
  ipcMain.handle('store:get', async (_, key: string) => {
    return (store as any).get(key)
  })

  ipcMain.handle('store:set', async (_, key: string, value: any) => {
    ;(store as any).set(key, value)
    return true
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
