/**
 * Servicios de Geocodificación PTEL
 * 
 * Fase 1: Geocodificación Especializada por Tipología
 * Fase 2: Cascada de Geocodificación Multinivel
 * 
 * @module services/geocoding
 */

// Orquestador principal (Fase 1)
export { GeocodingOrchestrator, type OrchestrationOptions, type OrchestrationResult } from './GeocodingOrchestrator';

// Cascada de geocodificación (Fase 2)
export { 
  CascadeOrchestrator, 
  cascadeOrchestrator,
  type GeocodingRequest,
  type GeocodingResult,
  type CascadeLevel,
  type CascadeConfig,
  type CascadeStats
} from './CascadeOrchestrator';

// Geocodificadores especializados
export * from './specialized';
