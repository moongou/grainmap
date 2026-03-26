import { contextBridge, ipcRenderer } from 'electron'

export interface API {
  // Database operations
  db: {
    init: () => Promise<void>
    createUser: (user: any) => Promise<any>
    getUser: (username: string) => Promise<any>
    validateUser: (username: string, password: string) => Promise<any>
    createPhoto: (photo: any) => Promise<any>
    getPhotosByUser: (userId: string) => Promise<any[]>
    updatePhoto: (id: string, photo: any) => Promise<any>
    deletePhoto: (id: string) => Promise<boolean>
    saveAIConfig: (userId: string, config: any) => Promise<any>
    getAIConfig: (userId: string) => Promise<any>
  }
  // File operations
  file: {
    selectImage: () => Promise<any>
    saveImage: (imageData: string, userId: string) => Promise<any>
    deleteImage: (filePath: string) => Promise<boolean>
    exportData: (data: any) => Promise<boolean>
    importData: () => Promise<any>
  }
  // Store operations
  store: {
    get: (key: string) => Promise<any>
    set: (key: string, value: any) => Promise<boolean>
  }
}

const api: API = {
  db: {
    init: () => ipcRenderer.invoke('db:init'),
    createUser: (user) => ipcRenderer.invoke('db:createUser', user),
    getUser: (username) => ipcRenderer.invoke('db:getUser', username),
    validateUser: (username, password) => ipcRenderer.invoke('db:validateUser', username, password),
    createPhoto: (photo) => ipcRenderer.invoke('db:createPhoto', photo),
    getPhotosByUser: (userId) => ipcRenderer.invoke('db:getPhotosByUser', userId),
    updatePhoto: (id, photo) => ipcRenderer.invoke('db:updatePhoto', id, photo),
    deletePhoto: (id) => ipcRenderer.invoke('db:deletePhoto', id),
    saveAIConfig: (userId, config) => ipcRenderer.invoke('db:saveAIConfig', userId, config),
    getAIConfig: (userId) => ipcRenderer.invoke('db:getAIConfig', userId),
  },
  file: {
    selectImage: () => ipcRenderer.invoke('file:selectImage'),
    saveImage: (imageData, userId) => ipcRenderer.invoke('file:saveImage', imageData, userId),
    deleteImage: (filePath) => ipcRenderer.invoke('file:deleteImage', filePath),
    exportData: (data) => ipcRenderer.invoke('file:exportData', data),
    importData: () => ipcRenderer.invoke('file:importData'),
  },
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
