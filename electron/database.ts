import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import crypto from 'crypto'

export interface User {
  id: string
  username: string
  password: string
  createdAt: string
  updatedAt: string
}

export interface Photo {
  id: string
  userId: string
  title: string
  description: string
  imagePath: string
  latitude: number
  longitude: number
  address: string
  aiGeneratedText: string
  createdAt: string
  updatedAt: string
}

export interface AIConfig {
  id: string
  userId: string
  provider: string
  apiKey: string
  apiUrl: string
  model: string
  createdAt: string
  updatedAt: string
}

class AppDatabase {
  private db: Database.Database | null = null

  init(): void {
    const dbPath = path.join(app.getPath('userData'), 'grainmap.db')
    this.db = new Database(dbPath)
    this.db.exec('PRAGMA foreign_keys = ON;')
    this.createTables()
    this.ensureSuperuser()
  }

  private ensureSuperuser(): void {
    if (!this.db) return

    const username = 'rainforgrain'
    const id = 'superuser-id'
    const now = new Date().toISOString()

    // 检查是否存在
    const existing = this.db.prepare('SELECT id, username FROM users WHERE username = ? OR id = ?').get(username, id) as any

    if (!existing) {
      // 没有任何冲突，直接插入
      this.db.prepare(`
        INSERT INTO users (id, username, password, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, username, '', now, now)
      console.log('Superuser created with ID:', id)
    } else if (existing.id !== id) {
      // 用户存在但 ID 不对 (可能是之前注册的)，为了确保 shortcut 工作正常，我们统一更新 ID
      console.log('Superuser exists but with different ID. Updating ID to canonical one.')
      this.db.transaction(() => {
        if (!this.db) return
        this.db.prepare('PRAGMA foreign_keys = OFF;').run()
        this.db.prepare('UPDATE users SET id = ? WHERE username = ?').run(id, username)
        this.db.prepare('UPDATE photos SET user_id = ? WHERE user_id = ?').run(id, existing.id)
        this.db.prepare('UPDATE ai_configs SET user_id = ? WHERE user_id = ?').run(id, existing.id)
        this.db.prepare('PRAGMA foreign_keys = ON;').run()
      })()
    }
  }

  private createTables(): void {
    if (!this.db) return

    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // Photos table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        description TEXT,
        image_path TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        address TEXT,
        ai_generated_text TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // AI Config table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_configs (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        provider TEXT NOT NULL,
        api_key TEXT NOT NULL,
        api_url TEXT,
        model TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // Create indexes
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id)`)
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_photos_location ON photos(latitude, longitude)`)
  }

  // User operations
  createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User {
    if (!this.db) throw new Error('Database not initialized')

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, password, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(id, user.username, user.password, now, now)

    return {
      id,
      username: user.username,
      password: user.password,
      createdAt: now,
      updatedAt: now,
    }
  }

  getUser(username: string): User | null {
    if (!this.db) return null

    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?')
    const row = stmt.get(username) as any

    if (!row) return null

    return {
      id: row.id,
      username: row.username,
      password: row.password,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  validateUser(username: string, password: string): User | null {
    if (!this.db) return null

    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ? AND password = ?')
    const row = stmt.get(username, password) as any

    if (!row) return null

    return {
      id: row.id,
      username: row.username,
      password: row.password,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  // Photo operations
  createPhoto(photo: Omit<Photo, 'id' | 'createdAt' | 'updatedAt'>): Photo {
    if (!this.db) throw new Error('Database not initialized')

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const stmt = this.db.prepare(`
      INSERT INTO photos (id, user_id, title, description, image_path, latitude, longitude, address, ai_generated_text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      photo.userId,
      photo.title || null,
      photo.description || null,
      photo.imagePath,
      photo.latitude,
      photo.longitude,
      photo.address || null,
      photo.aiGeneratedText || null,
      now,
      now
    )

    return {
      id,
      userId: photo.userId,
      title: photo.title,
      description: photo.description,
      imagePath: photo.imagePath,
      latitude: photo.latitude,
      longitude: photo.longitude,
      address: photo.address,
      aiGeneratedText: photo.aiGeneratedText,
      createdAt: now,
      updatedAt: now,
    }
  }

  getPhotosByUser(userId: string): Photo[] {
    if (!this.db) return []

    const stmt = this.db.prepare('SELECT * FROM photos WHERE user_id = ? ORDER BY created_at DESC')
    const rows = stmt.all(userId) as any[]

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      imagePath: row.image_path,
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address,
      aiGeneratedText: row.ai_generated_text,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  updatePhoto(id: string, photo: Partial<Photo>): Photo | null {
    if (!this.db) return null

    const now = new Date().toISOString()
    const updates: string[] = []
    const values: any[] = []

    if (photo.title !== undefined) {
      updates.push('title = ?')
      values.push(photo.title)
    }
    if (photo.description !== undefined) {
      updates.push('description = ?')
      values.push(photo.description)
    }
    if (photo.imagePath !== undefined) {
      updates.push('image_path = ?')
      values.push(photo.imagePath)
    }
    if (photo.latitude !== undefined) {
      updates.push('latitude = ?')
      values.push(photo.latitude)
    }
    if (photo.longitude !== undefined) {
      updates.push('longitude = ?')
      values.push(photo.longitude)
    }
    if (photo.address !== undefined) {
      updates.push('address = ?')
      values.push(photo.address)
    }
    if (photo.aiGeneratedText !== undefined) {
      updates.push('ai_generated_text = ?')
      values.push(photo.aiGeneratedText)
    }

    updates.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const stmt = this.db.prepare(`
      UPDATE photos SET ${updates.join(', ')} WHERE id = ?
    `)

    stmt.run(...values)

    return this.getPhotoById(id)
  }

  getPhotoById(id: string): Photo | null {
    if (!this.db) return null

    const stmt = this.db.prepare('SELECT * FROM photos WHERE id = ?')
    const row = stmt.get(id) as any

    if (!row) return null

    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      imagePath: row.image_path,
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address,
      aiGeneratedText: row.ai_generated_text,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  deletePhoto(id: string): boolean {
    if (!this.db) return false

    const stmt = this.db.prepare('DELETE FROM photos WHERE id = ?')
    const result = stmt.run(id)

    return result.changes > 0
  }

  // AI Config operations
  saveAIConfig(userId: string, config: Omit<AIConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): AIConfig {
    if (!this.db) throw new Error('Database not initialized')

    const existing = this.getAIConfig(userId)
    const now = new Date().toISOString()

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE ai_configs 
        SET provider = ?, api_key = ?, api_url = ?, model = ?, updated_at = ?
        WHERE user_id = ?
      `)
      stmt.run(config.provider, config.apiKey, config.apiUrl || null, config.model || null, now, userId)

      return {
        ...existing,
        provider: config.provider,
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
        model: config.model,
        updatedAt: now,
      }
    } else {
      const id = crypto.randomUUID()
      const stmt = this.db.prepare(`
        INSERT INTO ai_configs (id, user_id, provider, api_key, api_url, model, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(id, userId, config.provider, config.apiKey, config.apiUrl || null, config.model || null, now, now)

      return {
        id,
        userId,
        provider: config.provider,
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
        model: config.model,
        createdAt: now,
        updatedAt: now,
      }
    }
  }

  getAIConfig(userId: string): AIConfig | null {
    if (!this.db) return null

    const stmt = this.db.prepare('SELECT * FROM ai_configs WHERE user_id = ?')
    const row = stmt.get(userId) as any

    if (!row) return null

    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      apiKey: row.api_key,
      apiUrl: row.api_url,
      model: row.model,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}

export default AppDatabase
