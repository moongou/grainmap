import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import Database from './database'
import fs from 'fs'
import crypto from 'crypto'
import archiver from 'archiver'
import extract from 'extract-zip'
import exifr from 'exifr'
import * as piexif from 'piexifjs'

const FALLBACK_GEOCODER_URL = 'https://nominatim.openstreetmap.org/search'

// Helper function to convert decimal degrees to GPS rational for piexif
const degToRational = (deg: number) => {
  const absolute = Math.abs(deg)
  const d = Math.floor(absolute)
  const m = Math.floor((absolute - d) * 60)
  const s = Math.round((absolute - d - (m / 60)) * 3600 * 100)
  return [[d, 1], [m, 1], [s, 100]]
}

let store: any
let db: Database

// Register custom protocol for local images
protocol.registerSchemesAsPrivileged([
  { scheme: 'app-data', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
])

const createWindow = () => {
  const preloadPath = path.join(app.getAppPath(), 'dist-electron', 'preload.js')
  const appPath = app.getAppPath()

  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    titleBarStyle: 'hiddenInset',
    show: process.platform !== 'win32',
  })

  const isDev = process.env.VITE_DEV_SERVER_URL || !app.isPackaged

  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5174'
    mainWindow.loadURL(url)
    mainWindow.webContents.openDevTools()
  } else {
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

  if (process.platform === 'win32') {
    const splash = new BrowserWindow({
      width: 720,
      height: 420,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      show: true,
    })

    splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <html>
        <body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;overflow:hidden;">
          <img src="file://${path.join(app.getAppPath(), 'public', 'assets', 'installation-guide.png')}" style="width:100%;height:100%;object-fit:cover;opacity:1;transition:opacity .6s ease;" id="splash" />
          <script>
            setTimeout(() => {
              document.getElementById('splash').style.opacity = '0';
            }, 1000);
          </script>
        </body>
      </html>
    `)}`)

    setTimeout(() => {
      splash.close()
      mainWindow.show()
    }, 1600)
  }
}

app.whenReady().then(async () => {
  const isDev = process.env.VITE_DEV_SERVER_URL || !app.isPackaged

  if (isDev) {
    try {
      const { default: installExtension, REACT_DEVELOPER_TOOLS } = await import('electron-devtools-installer')
      await installExtension(REACT_DEVELOPER_TOOLS, { loadExtensionOptions: { allowFileAccess: true } })
      console.log('React DevTools installed')
    } catch (e) {
      console.error('Failed to install React DevTools:', e)
    }
  }

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

  ipcMain.handle('db:getPhotosByAlbum', async (_, albumId: string) => {
    return db.getPhotosByAlbum(albumId)
  })

  ipcMain.handle('db:updatePhoto', async (_, id: string, photo: any) => {
    return db.updatePhoto(id, photo)
  })

  ipcMain.handle('db:deletePhoto', async (_, id: string) => {
    return db.deletePhoto(id)
  })

  // Album IPC handlers
  ipcMain.handle('db:getAlbumsByUser', async (_, userId: string) => {
    return db.getAlbumsByUser(userId)
  })

  ipcMain.handle('db:createAlbum', async (_, userId: string, album: any) => {
    return db.createAlbum(userId, album)
  })

  ipcMain.handle('db:updateAlbum', async (_, id: string, album: any) => {
    return db.updateAlbum(id, album)
  })

  ipcMain.handle('db:deleteAlbum', async (_, id: string) => {
    return db.deleteAlbum(id)
  })

  ipcMain.handle('db:movePhotosToAlbum', async (_, photoIds: string[], albumId: string | null) => {
    return db.movePhotosToAlbum(photoIds, albumId)
  })

  ipcMain.handle('db:saveAIConfig', async (_, userId: string, config: any) => {
    return db.saveAIConfig(userId, config)
  })

  ipcMain.handle('db:getAIConfig', async (_, userId: string) => {
    return db.getAIConfig(userId)
  })

  // AI Connection Test
  ipcMain.handle('ai:testConnection', async (_, config: any) => {
    const { provider, apiKey, apiUrl } = config
    let url = apiUrl || ''

    try {
      let fetchUrl = url
      if (provider === 'ollama') {
        fetchUrl = url.replace(/\/api\/chat$/, '').replace(/\/$/, '') + '/api/tags'
      } else {
        if (!fetchUrl.endsWith('/models')) {
          fetchUrl = fetchUrl.replace(/\/chat\/completions$/, '').replace(/\/v1\/chat\/completions$/, '').replace(/\/$/, '')
          if (!fetchUrl.endsWith('/v1') && !fetchUrl.includes('/compatible-mode/v1') && !fetchUrl.includes('/api/paas/v4')) fetchUrl += '/v1'
          fetchUrl += '/models'
        }
      }

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      }

      if (apiKey && provider !== 'ollama') {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      const response = await net.fetch(fetchUrl, { headers })

      if (!response.ok) {
        throw new Error(`连接失败: ${response.status} ${response.statusText}`)
      }

      const data: any = await response.json()
      const models = provider === 'ollama'
        ? data.models?.map((m: any) => m.name) || []
        : data.data?.map((m: any) => m.id) || []

      return { success: true, models }
    } catch (error: any) {
      console.error('AI Connection Test Error:', error)
      return { success: false, error: error.message || '未知错误' }
    }
  })

  ipcMain.handle('map:searchLocation', async (_, query: string) => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      return { success: false, error: '请输入地点关键词' }
    }

    const apiKey = (store as any).get('tencentMapKey') || process.env.TENCENT_MAP_KEY || ''

    const fetchTencentLocation = async () => {
      if (!apiKey) {
        throw new Error('missing_tencent_key')
      }

      const url = `https://apis.map.qq.com/ws/geocoder/v1/?address=${encodeURIComponent(trimmedQuery)}&output=json&key=${encodeURIComponent(apiKey)}`
      const response = await net.fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`搜索失败: ${response.status} ${response.statusText}`)
      }

      const data: any = await response.json()
      const location = data?.result?.location
      if (!location) {
        throw new Error(data?.message || '未找到该地点')
      }

      return {
        title: data.result?.title || trimmedQuery,
        address: data.result?.address || trimmedQuery,
        latitude: location.lat,
        longitude: location.lng,
      }
    }

    const fetchFallbackLocation = async () => {
      const url = `${FALLBACK_GEOCODER_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(trimmedQuery)}`
      const response = await net.fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Grainmap/1.4.2',
        },
      })

      if (!response.ok) {
        throw new Error(`搜索失败: ${response.status} ${response.statusText}`)
      }

      const data: any = await response.json()
      const first = Array.isArray(data) ? data[0] : null
      if (!first) {
        throw new Error('未找到该地点')
      }

      return {
        title: first.name || trimmedQuery,
        address: first.display_name || trimmedQuery,
        latitude: Number(first.lat),
        longitude: Number(first.lon),
      }
    }

    try {
      try {
        const result = await fetchTencentLocation()
        return { success: true, result }
      } catch (error: any) {
        const message = error?.message || ''
        if (message !== 'missing_tencent_key' && !message.includes('key缺少') && !message.includes('key')) {
          throw error
        }
      }

      const fallbackResult = await fetchFallbackLocation()
      return { success: true, result: fallbackResult }
    } catch (error: any) {
      console.error('Map search error:', error)
      return { success: false, error: error.message || '地点搜索失败' }
    }
  })

// File operations
ipcMain.handle('file:selectImage', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
    ],
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const photos = []

    for (const filePath of result.filePaths) {
      const buffer = fs.readFileSync(filePath)
      const base64 = buffer.toString('base64')
      const ext = path.extname(filePath).toLowerCase()
      const mimeType = ext === '.png' ? 'image/png' :
                       ext === '.gif' ? 'image/gif' :
                       ext === '.webp' ? 'image/webp' : 'image/jpeg'

      // Try to extract EXIF data
      let exifData = null
      try {
        if (ext === '.jpg' || ext === '.jpeg') {
          exifData = await exifr.parse(buffer, {
            gps: true,
            tiff: true,
          })
        }
      } catch (err) {
        console.error('EXIF extraction error:', err)
      }

      photos.push({
        path: filePath,
        data: `data:${mimeType};base64,${base64}`,
        name: path.basename(filePath),
        exif: exifData ? {
          latitude: exifData.latitude,
          longitude: exifData.longitude,
          dateTime: exifData.DateTimeOriginal || exifData.CreateDate || null,
          photoDate: exifData.DateTimeOriginal || exifData.CreateDate
            ? new Date(exifData.DateTimeOriginal || exifData.CreateDate).toISOString().slice(0, 10)
            : null,
        } : null,
      })
    }

    return photos
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

ipcMain.handle('file:exportData', async (_, rawData: any) => {
  const result = await dialog.showSaveDialog({
    defaultPath: `grainmap-export-${new Date().toISOString().split('T')[0]}.grainmap`,
    filters: [{ name: 'Grainmap Export', extensions: ['grainmap'] }],
  })

  if (result.canceled) return false

  const exportFilePath = result.filePath
  const output = fs.createWriteStream(exportFilePath)
  const archive = archiver('zip', { zlib: { level: 9 } })
  const data = {
    ...rawData,
    photos: Array.isArray(rawData.photos)
      ? rawData.photos.map((photo: any) => ({ ...photo }))
      : [],
  }

  return new Promise((resolve, reject) => {
    output.on('close', () => resolve(true))
    archive.on('error', (err: Error) => reject(err))

    archive.pipe(output)

    if (Array.isArray(data.photos)) {
      for (const photo of data.photos) {
        let photoPath = photo.imagePath
        if (photoPath.startsWith('app-data://')) {
          photoPath = path.join(app.getPath('userData'), photoPath.slice('app-data://'.length))
        }

        if (!fs.existsSync(photoPath)) {
          continue
        }

        const ext = path.extname(photoPath).toLowerCase() || '.jpg'
        const exportFileName = `${photo.id || crypto.randomUUID()}${ext}`
        const assetPath = `photos/${exportFileName}`
        photo.exportAssetPath = assetPath

        if (ext === '.jpg' || ext === '.jpeg') {
          try {
            const imageBuffer = fs.readFileSync(photoPath)
            const imageBase64 = imageBuffer.toString('base64')
            const jpegData = `data:image/jpeg;base64,${imageBase64}`

            const gps: any = {}
            gps[piexif.GPSIFD.GPSLatitudeRef] = photo.latitude >= 0 ? 'N' : 'S'
            gps[piexif.GPSIFD.GPSLatitude] = degToRational(photo.latitude)
            gps[piexif.GPSIFD.GPSLongitudeRef] = photo.longitude >= 0 ? 'E' : 'W'
            gps[piexif.GPSIFD.GPSLongitude] = degToRational(photo.longitude)

            const exif: any = {}
            if (photo.aiGeneratedText) {
              exif[piexif.ExifIFD.UserComment] = [84, 101, 120, 116, 0, 0, 0, 0, ...Buffer.from(photo.aiGeneratedText, 'utf8')]
            }

            const zeroth: any = {}
            if (photo.title) {
              zeroth[piexif.ImageIFD.ImageDescription] = photo.title
            }

            const displayDate = photo.photoDate || photo.createdAt
            if (displayDate) {
              const date = new Date(displayDate)
              const dateStr = date.toISOString().replace(/T/, ' ').replace(/\..+/, '').replace(/-/g, ':')
              zeroth[piexif.ImageIFD.DateTime] = dateStr
            }

            const exifObj = { '0th': zeroth, 'Exif': exif, 'GPS': gps }
            const exifBytes = piexif.dump(exifObj)
            const newJpegData = piexif.insert(exifBytes, jpegData)
            const newBuffer = Buffer.from(newJpegData.split(',')[1], 'base64')

            archive.append(newBuffer, { name: assetPath })
          } catch (err) {
            console.error(`Error injecting EXIF for ${exportFileName}:`, err)
            archive.file(photoPath, { name: assetPath })
          }
        } else {
          archive.file(photoPath, { name: assetPath })
        }
      }
    }

    archive.append(JSON.stringify(data, null, 2), { name: 'data.json' })
    archive.finalize()
  })
})

ipcMain.handle('file:importData', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Grainmap Export', extensions: ['grainmap'] }],
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
    if (fs.existsSync(photosDir) && Array.isArray(data.photos)) {
      const importBatchId = crypto.randomUUID()
      const targetDir = path.join(app.getPath('userData'), 'photos', 'imported', importBatchId)
      fs.mkdirSync(targetDir, { recursive: true })

      for (const photo of data.photos) {
        const exportAssetPath = typeof photo.exportAssetPath === 'string' ? photo.exportAssetPath : ''
        const preferredSrcPath = exportAssetPath ? path.join(tempDir, exportAssetPath) : ''
        const legacyFileName = photo.imagePath?.split('/').pop() || `${crypto.randomUUID()}.jpg`
        const legacySrcPath = path.join(photosDir, legacyFileName)
        const srcPath = preferredSrcPath && fs.existsSync(preferredSrcPath) ? preferredSrcPath : legacySrcPath

        if (!fs.existsSync(srcPath)) {
          continue
        }

        const fileName = path.basename(srcPath)
        const targetPath = path.join(targetDir, fileName)
        fs.copyFileSync(srcPath, targetPath)
        photo.imagePath = `app-data://photos/imported/${importBatchId}/${fileName}`
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
