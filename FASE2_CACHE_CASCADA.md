# Fase 2: Sistema de Cache y Cascada de Geocodificación

## Resumen

La Fase 2 implementa un sistema de caché multinivel y una cascada de geocodificación de 6 niveles para optimizar las consultas y reducir la dependencia de APIs externas.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                    CascadeOrchestrator                          │
├─────────────────────────────────────────────────────────────────┤
│  L0: Cache Local ────► L1: WFS ────► L2: CartoCiudad ────►     │
│  L3: CDAU ────► L4: CDAU Fuzzy ────► L5: Nominatim             │
├─────────────────────────────────────────────────────────────────┤
│                      CacheManager                               │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │    GeoCache      │    │  IndexedDBCache  │                  │
│  │  (localStorage)  │    │   (IndexedDB)    │                  │
│  │    ~5MB          │    │   ~100MB         │                  │
│  │  Acceso rápido   │    │  Datasets grandes│                  │
│  └──────────────────┘    └──────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. GeoCache (localStorage)

**Ubicación:** `src/services/cache/GeoCache.ts`

Cache de acceso rápido para consultas frecuentes.

**Características:**
- Capacidad: ~5MB
- TTL: 90 días (configurable)
- Compresión LZ-String
- Estadísticas de uso (hits/misses)

**Uso:**
```typescript
import { geoCache } from '@/services/cache'

// Guardar
geoCache.set('key', { x: 500000, y: 4100000 }, 'CartoCiudad')

// Obtener
const result = geoCache.get<CoordData>('key')

// Estadísticas
const stats = geoCache.getStats()
```

### 2. IndexedDBCache

**Ubicación:** `src/services/cache/IndexedDBCache.ts`

Cache para datasets grandes (municipios completos).

**Características:**
- Capacidad: ~100MB
- Operaciones asíncronas
- Índices por municipio/tipo
- Búsqueda eficiente

**Uso:**
```typescript
import { indexedDBCache } from '@/services/cache'

// Guardar con metadata
await indexedDBCache.set('key', data, 'WFS', {
  municipality: 'Granada',
  infrastructureType: 'hospital'
})

// Buscar por municipio
const entries = await indexedDBCache.getByMunicipality('Granada')
```

### 3. CacheManager

**Ubicación:** `src/services/cache/CacheManager.ts`

Orquestador que decide cuál cache usar.

**Estrategia:**
- Datasets pequeños (<1000): localStorage
- Datasets grandes (≥1000): IndexedDB
- Búsquedas: localStorage primero, luego IndexedDB

**Uso:**
```typescript
import { cacheManager } from '@/services/cache'

// Obtener (busca en ambos)
const result = await cacheManager.get('key')
// result.source = 'localStorage' | 'indexedDB' | 'miss'

// Guardar (ambos niveles)
await cacheManager.set(entry)

// Estadísticas combinadas
const stats = await cacheManager.getStats()
```

### 4. CascadeOrchestrator

**Ubicación:** `src/services/geocoding/CascadeOrchestrator.ts`

Orquesta la geocodificación a través de 6 niveles.

**Niveles de cascada:**

| Nivel | Fuente | Confianza | Descripción |
|-------|--------|-----------|-------------|
| L0 | Cache | 95% | localStorage/IndexedDB |
| L1 | WFS | 90% | Geocodificador tipológico (Fase 1) |
| L2 | CartoCiudad | 85% | IGN oficial |
| L3 | CDAU | 80% | Callejero Andalucía |
| L4 | CDAU Fuzzy | 65% | Matching aproximado |
| L5 | Nominatim | 50% | OSM (último recurso) |

**Uso:**
```typescript
import { cascadeOrchestrator } from '@/services/geocoding'

const result = await cascadeOrchestrator.geocode({
  name: 'Hospital Virgen de las Nieves',
  infrastructureType: 'hospital',
  municipality: 'Granada',
  province: 'Granada'
})

// result.source = 'L0_CACHE' | 'L1_WFS' | etc.
// result.confidence = 0-100
// result.coordinates = { x, y, epsg }
```

## Configuración

### Cache TTL
```typescript
import { GeoCache } from '@/services/cache'

const cache = new GeoCache({
  ttlDays: 30,  // Cambiar TTL
  maxSizeMB: 10 // Límite de tamaño
})
```

### Niveles de cascada
```typescript
import { CascadeOrchestrator } from '@/services/geocoding'

const orchestrator = new CascadeOrchestrator({
  enabledLevels: ['L0_CACHE', 'L1_WFS', 'L2_CARTOCIUDAD'],
  maxRetries: 3,
  timeoutMs: 15000
})
```

## Circuit Breaker

El sistema incluye circuit breaker para APIs que fallan repetidamente:

- **Umbral:** 3 fallos consecutivos
- **Reset:** 60 segundos
- **Comportamiento:** Salta el nivel si está "abierto"

```typescript
// Resetear circuit breakers manualmente
cascadeOrchestrator.resetCircuitBreakers()
```

## Métricas

### Estadísticas de cache
```typescript
const stats = await cacheManager.getStats()
console.log(`Hit rate: ${stats.combined.hitRate * 100}%`)
console.log(`Total entries: ${stats.combined.totalEntries}`)
console.log(`Size: ${stats.combined.totalSize / 1024} KB`)
```

### Estadísticas de cascada
```typescript
const stats = cascadeOrchestrator.getStats()
console.log(`Requests: ${stats.totalRequests}`)
console.log(`Cache hit rate: ${stats.cacheHitRate * 100}%`)
console.log(`Avg latency: ${stats.avgLatencyMs}ms`)
console.log('By level:', stats.byLevel)
```

## Dependencias añadidas

```json
{
  "dexie": "^4.0.10",      // IndexedDB wrapper
  "lz-string": "^1.5.0"    // Compresión
}
```

## Estructura de archivos

```
src/services/
├── cache/
│   ├── index.ts           # Exportaciones
│   ├── GeoCache.ts        # localStorage cache
│   ├── IndexedDBCache.ts  # IndexedDB cache
│   └── CacheManager.ts    # Orquestador
└── geocoding/
    ├── index.ts           # Exportaciones (actualizado)
    ├── CascadeOrchestrator.ts  # Cascada 6 niveles
    └── specialized/       # WFS geocoders (Fase 1)
```

## Próximos pasos (Fase 3)

- [ ] Integración con visor Leaflet
- [ ] Corrección manual de coordenadas
- [ ] Precargar municipios completos
- [ ] Export/Import de cache

## Changelog

### v1.1.0 (2024-11-25)
- Implementado GeoCache (localStorage)
- Implementado IndexedDBCache
- Implementado CacheManager
- Implementado CascadeOrchestrator con 6 niveles
- Añadidas dependencias dexie y lz-string
- Circuit breaker para APIs fallidas
