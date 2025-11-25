/**
 * CacheManager - Orquestador de caché multinivel para geocodificación PTEL
 * 
 * Estrategia de delegación:
 * - Datasets pequeños (<1000 entradas): localStorage (GeoCache)
 * - Datasets grandes (≥1000 entradas): IndexedDB (IndexedDBCache)
 * - Búsquedas individuales: localStorage primero, luego IndexedDB
 * 
 * Características:
 * - Switching automático basado en tamaño
 * - Fallback graceful si IndexedDB no está disponible
 * - Estadísticas unificadas
 * - API síncrona para localStorage, async para IndexedDB
 */

import { GeoCache, geoCache, CacheEntry, CacheStats } from './GeoCache'
import { IndexedDBCache, indexedDBCache, IndexedCacheEntry } from './IndexedDBCache'

export interface CacheManagerConfig {
  thresholdEntries: number  // Umbral para cambiar a IndexedDB
  preferIndexedDB: boolean  // Preferir IndexedDB aunque sea dataset pequeño
  syncToIndexedDB: boolean  // Sincronizar localStorage a IndexedDB
}

export interface GeocodingCacheEntry {
  key: string
  coordinates: {
    x: number
    y: number
    epsg: string
  }
  source: string
  confidence: number
  timestamp: number
  metadata?: {
    municipality?: string
    infrastructureType?: string
    originalQuery?: string
    provider?: string
  }
}

export interface CacheResult<T> {
  value: T | null
  source: 'localStorage' | 'indexedDB' | 'miss'
  latencyMs: number
}

const DEFAULT_CONFIG: CacheManagerConfig = {
  thresholdEntries: 1000,
  preferIndexedDB: false,
  syncToIndexedDB: true
}

/**
 * Genera clave de caché normalizada para geocodificación
 */
export function generateCacheKey(
  infrastructureType: string,
  name: string,
  municipality?: string
): string {
  const parts = [
    infrastructureType.toLowerCase(),
    name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
  ]
  
  if (municipality) {
    parts.push(
      municipality.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
    )
  }
  
  return parts.join('::')
}

export class CacheManager {
  private localStorage: GeoCache
  private indexedDB: IndexedDBCache
  private config: CacheManagerConfig
  private indexedDBAvailable: boolean = true

  constructor(config: Partial<CacheManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.localStorage = geoCache
    this.indexedDB = indexedDBCache
    
    // Verificar disponibilidad de IndexedDB
    this.checkIndexedDBAvailability()
  }

  private async checkIndexedDBAvailability(): Promise<void> {
    try {
      await this.indexedDB.waitReady()
      this.indexedDBAvailable = true
    } catch {
      console.warn('[CacheManager] IndexedDB not available, falling back to localStorage only')
      this.indexedDBAvailable = false
    }
  }

  /**
   * Obtiene valor del caché (busca en ambos niveles)
   */
  async get<T = GeocodingCacheEntry>(key: string): Promise<CacheResult<T>> {
    const start = performance.now()

    // 1. Buscar en localStorage primero (más rápido)
    const localResult = this.localStorage.get<T>(key)
    if (localResult !== null) {
      return {
        value: localResult,
        source: 'localStorage',
        latencyMs: performance.now() - start
      }
    }

    // 2. Buscar en IndexedDB si está disponible
    if (this.indexedDBAvailable) {
      const indexedResult = await this.indexedDB.get<T>(key)
      if (indexedResult !== null) {
        // Promover a localStorage para acceso más rápido futuro
        this.localStorage.set(key, indexedResult, 'promoted_from_indexeddb')
        
        return {
          value: indexedResult,
          source: 'indexedDB',
          latencyMs: performance.now() - start
        }
      }
    }

    return {
      value: null,
      source: 'miss',
      latencyMs: performance.now() - start
    }
  }

  /**
   * Guarda valor en caché (decide dónde basado en configuración)
   */
  async set(
    entry: GeocodingCacheEntry,
    forceIndexedDB: boolean = false
  ): Promise<boolean> {
    // Actualizar la clave en el entry si es necesario
    const key = entry.key || generateCacheKey(
      entry.metadata?.infrastructureType || 'unknown',
      entry.metadata?.originalQuery || 'unknown',
      entry.metadata?.municipality
    )

    const entryWithKey = { ...entry, key }

    // Guardar en localStorage siempre (acceso rápido)
    const localSuccess = this.localStorage.set(
      key,
      entryWithKey,
      entry.source
    )

    // Sincronizar a IndexedDB si está configurado y disponible
    if (this.indexedDBAvailable && (this.config.syncToIndexedDB || forceIndexedDB)) {
      await this.indexedDB.set(
        key,
        entryWithKey,
        entry.source,
        {
          municipality: entry.metadata?.municipality,
          infrastructureType: entry.metadata?.infrastructureType
        }
      )
    }

    return localSuccess
  }

  /**
   * Guarda múltiples entradas (bulk insert)
   * Usa IndexedDB para datasets grandes
   */
  async setMany(entries: GeocodingCacheEntry[]): Promise<number> {
    let saved = 0

    // Si hay muchas entradas, usar IndexedDB directamente
    const useIndexedDB = entries.length >= this.config.thresholdEntries && this.indexedDBAvailable

    for (const entry of entries) {
      const key = entry.key || generateCacheKey(
        entry.metadata?.infrastructureType || 'unknown',
        entry.metadata?.originalQuery || 'unknown',
        entry.metadata?.municipality
      )

      const entryWithKey = { ...entry, key }

      if (useIndexedDB) {
        // Solo IndexedDB para datasets grandes
        const success = await this.indexedDB.set(
          key,
          entryWithKey,
          entry.source,
          {
            municipality: entry.metadata?.municipality,
            infrastructureType: entry.metadata?.infrastructureType
          }
        )
        if (success) saved++
      } else {
        // localStorage + opcional IndexedDB
        if (await this.set(entryWithKey)) saved++
      }
    }

    return saved
  }

  /**
   * Elimina entrada de ambos cachés
   */
  async delete(key: string): Promise<boolean> {
    const localDeleted = this.localStorage.delete(key)
    
    if (this.indexedDBAvailable) {
      await this.indexedDB.delete(key)
    }
    
    return localDeleted
  }

  /**
   * Invalida entradas en ambos cachés
   */
  async invalidate(filter?: {
    pattern?: string
    municipality?: string
    infrastructureType?: string
    source?: string
  }): Promise<{ localStorage: number; indexedDB: number }> {
    const localCount = this.localStorage.invalidate(filter?.pattern)
    
    let indexedCount = 0
    if (this.indexedDBAvailable) {
      indexedCount = await this.indexedDB.invalidate(filter)
    }
    
    return { localStorage: localCount, indexedDB: indexedCount }
  }

  /**
   * Obtiene estadísticas combinadas
   */
  async getStats(): Promise<{
    localStorage: CacheStats
    indexedDB: Awaited<ReturnType<IndexedDBCache['getStats']>> | null
    combined: {
      totalEntries: number
      totalSize: number
      hitRate: number
    }
  }> {
    const localStats = this.localStorage.getStats()
    
    let indexedStats = null
    if (this.indexedDBAvailable) {
      indexedStats = await this.indexedDB.getStats()
    }

    const totalHits = localStats.hits + (indexedStats?.hits || 0)
    const totalMisses = localStats.misses + (indexedStats?.misses || 0)
    const totalRequests = totalHits + totalMisses

    return {
      localStorage: localStats,
      indexedDB: indexedStats,
      combined: {
        totalEntries: localStats.totalEntries + (indexedStats?.totalEntries || 0),
        totalSize: localStats.totalSize + (indexedStats?.totalSize || 0),
        hitRate: totalRequests > 0 ? totalHits / totalRequests : 0
      }
    }
  }

  /**
   * Limpia ambos cachés
   */
  async clear(): Promise<{ localStorage: number; indexedDB: number }> {
    const localCount = this.localStorage.clear()
    
    let indexedCount = 0
    if (this.indexedDBAvailable) {
      indexedCount = await this.indexedDB.clear()
    }
    
    return { localStorage: localCount, indexedDB: indexedCount }
  }

  /**
   * Limpia entradas expiradas de ambos cachés
   */
  async cleanExpired(): Promise<{ localStorage: number; indexedDB: number }> {
    const localCount = this.localStorage.cleanExpired()
    
    let indexedCount = 0
    if (this.indexedDBAvailable) {
      indexedCount = await this.indexedDB.cleanExpired()
    }
    
    return { localStorage: localCount, indexedDB: indexedCount }
  }

  /**
   * Obtiene todas las entradas para un municipio (solo IndexedDB)
   */
  async getByMunicipality(municipality: string): Promise<GeocodingCacheEntry[]> {
    if (!this.indexedDBAvailable) {
      return []
    }

    const entries = await this.indexedDB.getByMunicipality(municipality)
    return entries.map(e => e.value as GeocodingCacheEntry)
  }

  /**
   * Obtiene todas las entradas para un tipo de infraestructura (solo IndexedDB)
   */
  async getByInfrastructureType(type: string): Promise<GeocodingCacheEntry[]> {
    if (!this.indexedDBAvailable) {
      return []
    }

    const entries = await this.indexedDB.getByInfrastructureType(type)
    return entries.map(e => e.value as GeocodingCacheEntry)
  }

  /**
   * Exporta todo el caché para backup
   */
  async export(): Promise<{
    localStorage: CacheEntry[]
    indexedDB: IndexedCacheEntry[]
  }> {
    // localStorage no tiene export nativo, habría que implementarlo
    // Por ahora solo exportamos IndexedDB
    const indexedEntries = this.indexedDBAvailable 
      ? await this.indexedDB.export()
      : []

    return {
      localStorage: [],
      indexedDB: indexedEntries
    }
  }

  /**
   * Verifica si existe una entrada en cualquier caché
   */
  async has(key: string): Promise<boolean> {
    if (this.localStorage.has(key)) {
      return true
    }

    if (this.indexedDBAvailable) {
      return await this.indexedDB.has(key)
    }

    return false
  }
}

// Exportar instancia singleton
export const cacheManager = new CacheManager()
