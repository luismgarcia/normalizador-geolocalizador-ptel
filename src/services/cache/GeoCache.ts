/**
 * GeoCache - Sistema de caché en localStorage para geocodificación
 * 
 * Características:
 * - TTL configurable (default 90 días)
 * - Compresión LZ-String para optimizar espacio
 * - Límite de tamaño ~5MB (límite localStorage)
 * - Invalidación por clave, patrón o completa
 * - Estadísticas de uso (hits/misses)
 */

import LZString from 'lz-string'

export interface CacheEntry<T = any> {
  key: string
  value: T
  timestamp: number
  expiresAt: number
  source: string
  hits: number
}

export interface CacheStats {
  totalEntries: number
  totalSize: number
  hits: number
  misses: number
  hitRate: number
  oldestEntry: number | null
  newestEntry: number | null
}

export interface GeoCacheConfig {
  prefix: string
  ttlDays: number
  maxSizeMB: number
  compressionEnabled: boolean
}

const DEFAULT_CONFIG: GeoCacheConfig = {
  prefix: 'ptel_geo_',
  ttlDays: 90,
  maxSizeMB: 5,
  compressionEnabled: true
}

export class GeoCache {
  private config: GeoCacheConfig
  private stats: { hits: number; misses: number }

  constructor(config: Partial<GeoCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.stats = { hits: 0, misses: 0 }
    this.cleanExpired()
  }

  /**
   * Genera clave de caché normalizada
   */
  generateKey(type: string, identifier: string, municipality?: string): string {
    const parts = [type, identifier]
    if (municipality) {
      parts.push(municipality.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    }
    return this.config.prefix + parts.join('_').replace(/\s+/g, '_').toLowerCase()
  }

  /**
   * Obtiene valor del caché
   */
  get<T>(key: string): T | null {
    try {
      const fullKey = key.startsWith(this.config.prefix) ? key : this.config.prefix + key
      const raw = localStorage.getItem(fullKey)
      
      if (!raw) {
        this.stats.misses++
        return null
      }

      const data = this.config.compressionEnabled 
        ? LZString.decompress(raw)
        : raw

      if (!data) {
        this.stats.misses++
        return null
      }

      const entry: CacheEntry<T> = JSON.parse(data)

      // Verificar expiración
      if (Date.now() > entry.expiresAt) {
        localStorage.removeItem(fullKey)
        this.stats.misses++
        return null
      }

      // Actualizar hits
      entry.hits++
      this.set(key, entry.value, entry.source)
      
      this.stats.hits++
      return entry.value
    } catch (error) {
      console.warn('[GeoCache] Error reading cache:', error)
      this.stats.misses++
      return null
    }
  }

  /**
   * Guarda valor en caché
   */
  set<T>(key: string, value: T, source: string = 'unknown'): boolean {
    try {
      const fullKey = key.startsWith(this.config.prefix) ? key : this.config.prefix + key
      
      const entry: CacheEntry<T> = {
        key: fullKey,
        value,
        timestamp: Date.now(),
        expiresAt: Date.now() + (this.config.ttlDays * 24 * 60 * 60 * 1000),
        source,
        hits: 0
      }

      const serialized = JSON.stringify(entry)
      const toStore = this.config.compressionEnabled 
        ? LZString.compress(serialized)
        : serialized

      if (!toStore) {
        console.warn('[GeoCache] Compression failed')
        return false
      }

      // Verificar tamaño antes de guardar
      const sizeKB = new Blob([toStore]).size / 1024
      if (sizeKB > this.config.maxSizeMB * 1024) {
        console.warn('[GeoCache] Entry too large:', sizeKB, 'KB')
        return false
      }

      // Intentar guardar, limpiar si no hay espacio
      try {
        localStorage.setItem(fullKey, toStore)
      } catch (e) {
        // Probablemente QuotaExceededError
        this.evictOldest(10)
        localStorage.setItem(fullKey, toStore)
      }

      return true
    } catch (error) {
      console.warn('[GeoCache] Error writing cache:', error)
      return false
    }
  }

  /**
   * Elimina entrada específica
   */
  delete(key: string): boolean {
    const fullKey = key.startsWith(this.config.prefix) ? key : this.config.prefix + key
    localStorage.removeItem(fullKey)
    return true
  }

  /**
   * Invalida entradas por patrón
   */
  invalidate(pattern?: string): number {
    let count = 0
    const keys = this.getAllKeys()

    for (const key of keys) {
      if (!pattern || key.includes(pattern)) {
        localStorage.removeItem(key)
        count++
      }
    }

    return count
  }

  /**
   * Limpia entradas expiradas
   */
  cleanExpired(): number {
    let cleaned = 0
    const keys = this.getAllKeys()

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue

        const data = this.config.compressionEnabled 
          ? LZString.decompress(raw)
          : raw

        if (!data) {
          localStorage.removeItem(key)
          cleaned++
          continue
        }

        const entry: CacheEntry = JSON.parse(data)
        if (Date.now() > entry.expiresAt) {
          localStorage.removeItem(key)
          cleaned++
        }
      } catch {
        localStorage.removeItem(key)
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * Elimina las N entradas más antiguas
   */
  private evictOldest(count: number): number {
    const entries: { key: string; timestamp: number }[] = []
    const keys = this.getAllKeys()

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue

        const data = this.config.compressionEnabled 
          ? LZString.decompress(raw)
          : raw

        if (data) {
          const entry: CacheEntry = JSON.parse(data)
          entries.push({ key, timestamp: entry.timestamp })
        }
      } catch {
        // Entrada corrupta, eliminar
        localStorage.removeItem(key)
      }
    }

    // Ordenar por timestamp (más antiguo primero)
    entries.sort((a, b) => a.timestamp - b.timestamp)

    let evicted = 0
    for (let i = 0; i < Math.min(count, entries.length); i++) {
      localStorage.removeItem(entries[i].key)
      evicted++
    }

    return evicted
  }

  /**
   * Obtiene todas las claves del caché
   */
  private getAllKeys(): string[] {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(this.config.prefix)) {
        keys.push(key)
      }
    }
    return keys
  }

  /**
   * Obtiene estadísticas del caché
   */
  getStats(): CacheStats {
    const keys = this.getAllKeys()
    let totalSize = 0
    let oldestEntry: number | null = null
    let newestEntry: number | null = null

    for (const key of keys) {
      const raw = localStorage.getItem(key)
      if (raw) {
        totalSize += new Blob([raw]).size

        try {
          const data = this.config.compressionEnabled 
            ? LZString.decompress(raw)
            : raw

          if (data) {
            const entry: CacheEntry = JSON.parse(data)
            if (!oldestEntry || entry.timestamp < oldestEntry) {
              oldestEntry = entry.timestamp
            }
            if (!newestEntry || entry.timestamp > newestEntry) {
              newestEntry = entry.timestamp
            }
          }
        } catch {
          // Ignorar entradas corruptas para stats
        }
      }
    }

    const totalRequests = this.stats.hits + this.stats.misses
    return {
      totalEntries: keys.length,
      totalSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      oldestEntry,
      newestEntry
    }
  }

  /**
   * Limpia todo el caché
   */
  clear(): number {
    return this.invalidate()
  }

  /**
   * Verifica si una clave existe (sin contar como hit/miss)
   */
  has(key: string): boolean {
    const fullKey = key.startsWith(this.config.prefix) ? key : this.config.prefix + key
    return localStorage.getItem(fullKey) !== null
  }

  /**
   * Obtiene el tamaño actual en bytes
   */
  getSize(): number {
    let size = 0
    const keys = this.getAllKeys()
    for (const key of keys) {
      const raw = localStorage.getItem(key)
      if (raw) {
        size += new Blob([raw]).size
      }
    }
    return size
  }
}

// Exportar instancia singleton
export const geoCache = new GeoCache()
