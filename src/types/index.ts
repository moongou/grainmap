export interface User {
  id: string;
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  userId: string;
  albumId?: string | null;
  title: string;
  description: string;
  imagePath: string;
  imageData?: string;
  latitude: number;
  longitude: number;
  address: string;
  aiGeneratedText: string;
  createdAt: string;
  updatedAt: string;
}

export interface Album {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIConfig {
  id: string;
  userId: string;
  provider: 'openai' | 'claude' | 'ollama' | 'volcano' | 'custom';
  apiKey: string;
  apiUrl?: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MapMarker {
  id: string;
  position: [number, number];
  title: string;
  imagePath: string;
  photo: Photo;
}

export interface AMapPosition {
  lng: number;
  lat: number;
}
