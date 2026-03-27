const { contextBridge, ipcRenderer } = require('electron')

const api = {
  db: {
    init: () => ipcRenderer.invoke('db:init'),
    createUser: (user: any) => ipcRenderer.invoke('db:createUser', user),
    getUser: (username: string) => ipcRenderer.invoke('db:getUser', username),
    validateUser: (username: string, password: string) => ipcRenderer.invoke('db:validateUser', username, password),
    createPhoto: (photo: any) => ipcRenderer.invoke('db:createPhoto', photo),
    getPhotosByUser: (userId: string) => ipcRenderer.invoke('db:getPhotosByUser', userId),
    updatePhoto: (id: string, photo: any) => ipcRenderer.invoke('db:updatePhoto', id, photo),
    deletePhoto: (id: string) => ipcRenderer.invoke('db:deletePhoto', id),
    saveAIConfig: (userId: string, config: any) => ipcRenderer.invoke('db:saveAIConfig', userId, config),
    getAIConfig: (userId: string) => ipcRenderer.invoke('db:getAIConfig', userId),
  },
  file: {
    selectImage: () => ipcRenderer.invoke('file:selectImage'),
    saveImage: (imageData: string, userId: string) => ipcRenderer.invoke('file:saveImage', imageData, userId),
    deleteImage: (filePath: string) => ipcRenderer.invoke('file:deleteImage', filePath),
    exportData: (data: any) => ipcRenderer.invoke('file:exportData', data),
    importData: () => ipcRenderer.invoke('file:importData'),
  },
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
