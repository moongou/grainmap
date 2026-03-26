/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI: {
      db: {
        init: () => Promise<void>;
        createUser: (user: any) => Promise<any>;
        getUser: (username: string) => Promise<any>;
        validateUser: (username: string, password: string) => Promise<any>;
        createPhoto: (photo: any) => Promise<any>;
        getPhotosByUser: (userId: string) => Promise<any[]>;
        updatePhoto: (id: string, photo: any) => Promise<any>;
        deletePhoto: (id: string) => Promise<boolean>;
        saveAIConfig: (userId: string, config: any) => Promise<any>;
        getAIConfig: (userId: string) => Promise<any>;
      };
      file: {
        selectImage: () => Promise<any>;
        saveImage: (imageData: string, userId: string) => Promise<any>;
        deleteImage: (filePath: string) => Promise<boolean>;
        exportData: (data: any) => Promise<boolean>;
        importData: () => Promise<any>;
      };
      store: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<boolean>;
      };
    };
  }
}

export {};
