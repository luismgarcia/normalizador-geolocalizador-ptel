/**
 * IndexedDBCache - Sistema de caché en IndexedDB para datasets grandes
 * 
 * Características:
 * - Capacidad 50-100MB (límite del navegador)
 * - Ideal para datasets de municipios completos
 * - Operaciones asíncronas
 * - TTL configurable (default 90 días)
 * - Índices para búsqueda rápida por municipio/tipo
 */

import Dexie, { Table } from 'dexie'

export interface IndexedCacheEntry {
  id?: number
  key: string
  value: any
  timestamp: number
  expiresAt: number
  source: string
  municipality?: string
  infrastructureType?: string
  hits: number
  sizeBytes: number
}

export interface IndexedDBCacheConfig {
  dbName: string
  ttlDays: number
  maxSizeMB: number
}

const DEFAULT_CONFIG: IndexedDBCacheConfig = {
  dbName: 'ptel_geocache',
  ttlDays: 90,
  maxSizeMB: 100
}

class GeoCacheDB extends Dexie {
  entries!: Table<IndexedCacheEntry, number>

  constructor(dbName: string) {
    super(dbName)
    
    this.version(1).stores({
      entries: '++id, key, timestamp, expiresAt, source, municipality, infrastructureType'
    })
  }
}

export class IndexedDBCache {
  private db: GeoCacheDB
  private config: IndexedDBCacheConfig
  private stats: { hits: number; misses: number }
  private ready: Promise<void>

  constructor(config: Partial<IndexedDBCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.stats = { hits: 0, misses: 0 }
    this.db = new GeoCacheDB(this.config.dbName)
    
    // Inicializar y limpiar expirados
    this.ready = this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      await this.db.open()
      await this.cleanExpired()
    } catch (error) {
      console.error('[IndexedDBCache] Failed to initialize:', error)
    }
  }

  /**
   * Esperar a que la DB esté lista
   */
  async waitReady(): Promise<void> {
    await this.ready
  }

  /**
   * Genera clave de caché normalizada
   */
  generateKey(type: string, identifier: string, municipality?: string): string {
    const parts = [type, identifier]
    if (municipality) {
      parts.push(municipality.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    }
    return parts.join('_').replace(/\s+/g, '_').toLowerCase()
  }

  /**
   * Obtiene valor del caché
   */
  async get<T>(key: string): Promise<T | null> {
    await this.ready

    try {
      const entry = await this.db.entries.where('key').equals(key).first()

      if (!entry) {
        this.stats.misses++
        return null
      }

      // Verificar expiración
      if (Date.now() > entry.expiresAt) {
        await this.db.entries.delete(entry.id!)
        this.stats.misses++
        return null
      }

      // Actualizar hits
      await this.db.entries.update(entry.id!, { hits: entry.hits + 1 })
      
      this.stats.hits++
      return entry.value as T
    } catch (error) {
      console.warn('[IndexedDBCache] Error reading cache:', error)
      this.stats.misses++
      return null
    }
  }

  /**
   * Guarda valor en caché
   */
  async set<T>(
    key: string, 
    value: T, 
    source: string = 'unknown',
    metadata?: { municipality?: string; infrastructureType?: string }
  ): Promise<boolean> {
    await this.ready

    try {
      const serialized = JSON.stringify(value)
      const sizeBytes = new Blob([serialized]).size

      // Verificar límite de tamaño
      const currentSize = await this.getSize()
      if ((currentSize + sizeBytes) > this.config.maxSizeMB * 1024 * 1024) {
        // Evictar entradas antiguas
        await this.evictOldest(Math.ceil(sizeBytes / 10000))
      }

      const entry: IndexedCacheEntry = {
        key,
        value,
        timestamp: Date.now(),
        expiresAt: Date.now() + (this.config.ttlDays * 24 * 60 * 60 * 1000),
        source,
        municipality: metadata?.municipality,
        infrastructureType: metadata?.infrastructureType,
        hits: 0,
        sizeBytes
      }

      // Upsert: eliminar existente si hay
      await this.db.entries.where('key').equals(key).delete()
      await this.db.entries.add(entry)

      return true
    } catch (error) {
      console.warn('[IndexedDBCache] Error writing cache:', error)
      return false
    }
  }

  /**
   * Elimina entrada específica
   */
  async delete(key: string): Promise<boolean> {
    await this.ready

    try {
      await this.db.entries.where('key').equals(key).delete()
      return true
    } catch (error) {
      console.warn('[IndexedDBCache] Error deleting:', error)
      return false
    }
  }

  /**
   * Invalida entradas por patrón o filtro
   */
  async invalidate(filter?: { 
    pattern?: string
    municipality?: string
    infrastructureType?: string
    source?: string
  }): Promise<number> {
    await this.ready

    try {
      if (!filter) {
        const count = await this.db.entries.count()
        await this.db.entries.clear()
        return count
      }

      let collection = this.db.entries.toCollection()

      if (filter.municipality) {
        collection = this.db.entries.where('municipality').equals(filter.municipality)
      } else if (filter.infrastructureType) {
        collection = this.db.entries.where('infrastructureType').equals(filter.infrastructureType)
      } else if (filter.source) {
        collection = this.db.entries.where('source').equals(filter.source)
      }

      const entries = await collection.toArray()
      let count = 0

      for (const entry of entries) {
        if (!filter.pattern || entry.key.includes(filter.pattern)) {
          await this.db.entries.delete(entry.id!)
          count++
        }
      }

      return count
    } catch (error) {
      console.warn('[IndexedDBCache] Error invalidating:', error)
      return 0
    }
  }

  /**
   * Limpia entradas expiradas
   */
  async cleanExpired(): Promise<number> {
    await this.ready

    try {
      const now = Date.now()
      const expired = await this.db.entries
        .where('expiresAt')
        .below(now)
        .toArray()

      for (const entry of expired) {
        await this.db.entries.delete(entry.id!)
      }

      return expired.length
    } catch (error) {
      console.warn('[IndexedDBCache] Error cleaning expired:', error)
      return 0
    }
  }

  /**
   * Elimina las N entradas más antiguas
   */
  private async evictOldest(count: number): Promise<number> {
    try {
      const oldest = await this.db.entries
        .orderBy('timestamp')
        .limit(count)
        .toArray()

      for (const entry of oldest) {
        await this.db.entries.delete(entry.id!)
      }

      return oldest.length
    } catch (error) {
      console.warn('[IndexedDBCache] Error evicting:', error)
      return 0
    }
  }

  /**
   * Obtiene todas las entradas para un municipio
   */
  async getByMunicipality(municipality: string): Promise<IndexedCacheEntry[]> {
    await this.ready

    try {
      const normalized = municipality.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      return await this.db.entries
        .where('municipality')
        .equals(normalized)
        .toArray()
    } catch (error) {
      console.warn('[IndexedDBCache] Error querying by municipality:', error)
      return []
    }
  }

  /**
   * Obtiene todas las entradas para un tipo de infraestructura
   */
  async getByInfrastructureType(type: string): Promise<IndexedCacheEntry[]> {
    await this.ready

    try {
      return await this.db.entries
        .where('infrastructureType')
        .equals(type)
        .toArray()
    } catch (error) {
      console.warn('[IndexedDBCache] Error querying by type:', error)
      return []
    }
  }

  /**
   * Obtiene estadísticas del caché
   */
  async getStats(): Promise<{
    totalEntries: number
    totalSize: number
    hits: number
    misses: number
    hitRate: number
    bySource: Record<string, number>
    byMunicipality: Record<string, number>
  }> {
    await this.ready

    try {
      const entries = await this.db.entries.toArray()
      
      let totalSize = 0
      const bySource: Record<string, number> = {}
      const byMunicipality: Record<string, number> = {}

      for (const entry of entries) {
        totalSize += entry.sizeBytes

        bySource[entry.source] = (bySource[entry.source] || 0) + 1
        
        if (entry.municipality) {
          byMunicipality[entry.municipality] = (byMunicipality[entry.municipality] || 0) + 1
        }
      }

      const totalRequests = this.stats.hits + this.stats.misses
      return {
        totalEntries: entries.length,
        totalSize,
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
        bySource,
        byMunicipality
      }
    } catch (error) {
      console.warn('[IndexedDBCache] Error getting stats:', error)
      return {
        totalEntries: 0,
        totalSize: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        bySource: {},
        byMunicipality: {}
      }
    }
  }

  /**
   * Obtiene el tamaño actual en bytes
   */
  async getSize(): Promise<number> {
    await this.ready

    try {
      const entries = await this.db.entries.toArray()
      return entries.reduce((sum, entry) => sum + entry.sizeBytes, 0)
    } catch (error) {
      return 0
    }
  }

  /**
   * Limpia todo el caché
   */
  async clear(): Promise<number> {
    return await this.invalidate()
  }

  /**
   * Verifica si una clave existe
   */
  async has(key: string): Promise<boolean> {
    await this.ready

    try {
      const count = await this.db.entries.where('key').equals(key).count()
      return count > 0
    } catch (error) {
      return false
    }
  }

  /**
   * Exporta todo el caché (para backup)
   */
  async export(): Promise<IndexedCacheEntry[]> {
    await this.ready
    return await this.db.entries.toArray()
  }

  /**
   * Importa datos al caché (desde backup)
   */
  async import(entries: IndexedCacheEntry[]): Promise<number> {
    await this.ready

    let imported = 0
    for (const entry of entries) {
      try {
        // No importar expirados
        if (Date.now() > entry.expiresAt) continue

        await this.db.entries.add({
          ...entry,
          id: undefined // Dejar que Dexie genere nuevo ID
        })
        imported++
      } catch {
        // Ignorar duplicados
      }
    }

    return imported
  }
}

// Exportar instancia singleton
export const indexedDBCache = new IndexedDBCache()
