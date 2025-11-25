/**
 * Cache Services - Exportaciones públicas
 * 
 * Sistema de caché multinivel para geocodificación PTEL
 */

// Componentes principales
export { GeoCache, geoCache } from './GeoCache'
export { IndexedDBCache, indexedDBCache } from './IndexedDBCache'
export { CacheManager, cacheManager, generateCacheKey } from './CacheManager'

// Tipos
export type { CacheEntry, CacheStats, GeoCacheConfig } from './GeoCache'
export type { IndexedCacheEntry, IndexedDBCacheConfig } from './IndexedDBCache'
export type { 
  CacheManagerConfig, 
  GeocodingCacheEntry, 
  CacheResult 
} from './CacheManager'
