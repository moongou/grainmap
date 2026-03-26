import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from './database.js'
import Store from 'electron-store'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const store = new Store()
let db: Database

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
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // 修复打包后的路径问题
    const indexPath = path.join(__dirname, '../../dist/index.html')
    mainWindow.loadFile(indexPath)
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

app.whenReady().then(() => {
  db = new Database()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC handlers
ipcMain.handle('db:init', async () => {
  return db.init()
})

ipcMain.handle('db:createUser', async (_, user) => {
  return db.createUser(user)
})

ipcMain.handle('db:getUser', async (_, username) => {
  return db.getUser(username)
})

ipcMain.handle('db:validateUser', async (_, username, password) => {
  return db.validateUser(username, password)
})

ipcMain.handle('db:createPhoto', async (_, photo) => {
  return db.createPhoto(photo)
})

ipcMain.handle('db:getPhotosByUser', async (_, userId) => {
  return db.getPhotosByUser(userId)
})

ipcMain.handle('db:updatePhoto', async (_, id, photo) => {
  return db.updatePhoto(id, photo)
})

ipcMain.handle('db:deletePhoto', async (_, id) => {
  return db.deletePhoto(id)
})

ipcMain.handle('db:saveAIConfig', async (_, userId, config) => {
  return db.saveAIConfig(userId, config)
})

ipcMain.handle('db:getAIConfig', async (_, userId) => {
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

  const photoId = uuidv4()
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')
  const filePath = path.join(userDataPath, `${photoId}.jpg`)
  
  fs.writeFileSync(filePath, buffer)
  
  return {
    id: photoId,
    path: filePath,
    relativePath: path.join('photos', userId, `${photoId}.jpg`),
  }
})

ipcMain.handle('file:deleteImage', async (_, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return true
  } catch (error) {
    console.error('Delete image error:', error)
    return false
  }
})

ipcMain.handle('file:exportData', async (_, data: any) => {
  const result = await dialog.showSaveDialog({
    defaultPath: `grainmap-backup-${new Date().toISOString().split('T')[0]}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })

  if (!result.canceled) {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2))
    return true
  }
  return false
})

ipcMain.handle('file:importData', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const content = fs.readFileSync(result.filePaths[0], 'utf-8')
    return JSON.parse(content)
  }
  return null
})

// Store operations for settings
ipcMain.handle('store:get', async (_, key) => {
  return store.get(key)
})

ipcMain.handle('store:set', async (_, key, value) => {
  store.set(key, value)
  return true
})
