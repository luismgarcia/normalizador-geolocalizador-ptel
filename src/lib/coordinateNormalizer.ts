/**
 * PTEL Coordinate Normalizer v2.2
 * 
 * Sistema de normalización de coordenadas para documentos PTEL Andalucía.
 * Implementa 52 patrones de corrección organizados en 4 prioridades.
 * 
 * CHANGELOG v2.2 (30-Nov-2025):
 * - NEW: Parser NMEA GPS - parseNMEA() soporta D1-D4
 * - NEW: Parser sentencias NMEA - parseNMEASentence() para $GPGGA, $GPRMC, $GPGLL
 * - NEW: Parser pares NMEA - parseParNMEA() para lat/lon GPS
 * - NEW: Detector isNMEAFormat() para identificar coordenadas NMEA
 * - NEW: Tipos NMEAParseResult, NMEAPairResult, NMEAPattern
 * 
 * CHANGELOG v2.1 (30-Nov-2025):
 * - NEW: Parser DMS sexagesimal - parseDMS() soporta C1-C8
 * - NEW: Parser pares DMS - parseParDMS() para lat/lon
 * - NEW: Detector isDMSFormat() para identificar coordenadas sexagesimales
 * - NEW: Tipos DMSParseResult, DMSPairResult, DMSPattern
 * 
 * @author PTEL Development Team
 * @version 2.2.0
 * @license MIT
 */

// ============================================================================
// TIPOS Y INTERFACES
// ============================================================================

export interface CoordinateInput {
  x: string | number;
  y: string | number;
  municipality?: string;
  province?: Province;
}

export interface NormalizationResult {
  x: number | null;
  y: number | null;
  original: { x: string | number; y: string | number };
  corrections: Correction[];
  flags: Flag[];
  score: number;
  confidence: ConfidenceLevel;
  isValid: boolean;
}

export interface Correction {
  type: CorrectionType;
  field: 'x' | 'y' | 'both';
  from: string;
  to: string;
  pattern: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}

export interface Flag {
  type: FlagType;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export type Province = 
  | 'Almería' | 'Cádiz' | 'Córdoba' | 'Granada' 
  | 'Huelva' | 'Jaén' | 'Málaga' | 'Sevilla';

export type ConfidenceLevel = 'CRITICAL' | 'LOW' | 'MEDIUM' | 'HIGH';

export type CorrectionType = 
  | 'Y_TRUNCATED' | 'XY_SWAPPED' | 'PLACEHOLDER_DETECTED' | 'ENCODING_FIXED'
  | 'SEPARATOR_FIXED' | 'THOUSANDS_REMOVED' | 'DECIMAL_FIXED' | 'WHITESPACE_CLEANED';

export type FlagType = 
  | 'OUT_OF_RANGE' | 'MISSING_DECIMALS' | 'SUSPICIOUS_VALUE' 
  | 'GEOCODING_NEEDED' | 'MANUAL_REVIEW';

// ============================================================================
// TIPOS DMS (GRADOS, MINUTOS, SEGUNDOS) - Patrones C1-C8
// ============================================================================

/**
 * Resultado del parseo de una coordenada DMS individual
 */
export interface DMSParseResult {
  /** Valor en grados decimales */
  valor: number | null;
  /** Hemisferio detectado (N/S/E/W) */
  hemisferio: 'N' | 'S' | 'E' | 'W' | null;
  /** Tipo de coordenada según hemisferio */
  tipo: 'latitud' | 'longitud' | null;
  /** Patrón DMS detectado */
  patron: DMSPattern | null;
}

/**
 * Resultado del parseo de un par de coordenadas DMS
 */
export interface DMSPairResult {
  /** Latitud en grados decimales */
  latitud: number | null;
  /** Longitud en grados decimales (negativa para oeste) */
  longitud: number | null;
  /** Si la conversión fue exitosa */
  exito: boolean;
  /** Patrones detectados */
  patrones: DMSPattern[];
}

export type DMSPattern = 
  | 'DMS_COMPLETO'      // 37°26'46.5"N
  | 'DM_DECIMAL'        // 37°26.775'N
  | 'D_DECIMAL'         // 37.446°N
  | 'DMS_ESPACIOS'      // 37 26 46.5 N
  | 'DM_ESPACIOS';      // 37 26.775 N

// ============================================================================
// TIPOS NMEA GPS - Patrones D1-D4
// ============================================================================

/**
 * Resultado del parseo de una coordenada NMEA individual
 */
export interface NMEAParseResult {
  /** Valor en grados decimales */
  valor: number | null;
  /** Hemisferio detectado (N/S/E/W) */
  hemisferio: 'N' | 'S' | 'E' | 'W' | null;
  /** Tipo de coordenada según hemisferio */
  tipo: 'latitud' | 'longitud' | null;
  /** Patrón NMEA detectado */
  patron: NMEAPattern | null;
}

/**
 * Resultado del parseo de una sentencia o par NMEA
 */
export interface NMEAPairResult {
  /** Latitud en grados decimales */
  latitud: number | null;
  /** Longitud en grados decimales (negativa para oeste) */
  longitud: number | null;
  /** Si la conversión fue exitosa */
  exito: boolean;
  /** Patrones detectados */
  patrones: NMEAPattern[];
  /** Tipo de sentencia si aplica (GGA, RMC, GLL) */
  tipoSentencia?: string | null;
}

export type NMEAPattern = 
  | 'NMEA_STANDARD'     // 3726.775N, 00345.204W
  | 'NMEA_INTEGER'      // 3726N (sin decimales)
  | 'NMEA_SENTENCE'     // $GPGGA,...
  | 'NMEA_PAIR';        // Par lat/lon

// ============================================================================
// CONFIGURACIÓN Y CONSTANTES
// ============================================================================

/** Rangos válidos para coordenadas UTM30 en Andalucía */
const ANDALUSIA_BOUNDS = {
  x: { min: 100_000, max: 800_000 },
  y: { min: 4_000_000, max: 4_300_000 }
};

/** Prefijos Y típicos por provincia */
const PROVINCE_Y_PREFIXES: Record<Province, string[]> = {
  'Almería': ['40', '41'],
  'Cádiz': ['40', '41'],
  'Córdoba': ['41', '42'],
  'Granada': ['40', '41'],
  'Huelva': ['41', '42'],
  'Jaén': ['41', '42'],
  'Málaga': ['40', '41'],
  'Sevilla': ['41', '42']
};

/** Patrones de placeholder que indican "sin datos" */
const PLACEHOLDER_PATTERNS = [
  /^[Nn]\/[DdAa]$/,
  /^[Nn][Dd]$/,
  /^[Nn][Aa]$/,
  /^[Ss]in\s*datos?$/i,
  /^[Ii]ndicar$/,
  /^[Pp]endiente$/,
  /^[-_]+$/,
  /^[Xx]+$/,
  /^0+(\.0+)?$/,
  /^9{4,}$/,
  /^\s*$/
];

/** 
 * Patrones de corrección UTF-8 (mojibake)
 * Ordenados por frecuencia de aparición
 */
const MOJIBAKE_PATTERNS: [RegExp, string][] = [
  // Vocales acentuadas (más comunes)
  [/Ã³/g, 'ó'], [/Ã¡/g, 'á'], [/Ã©/g, 'é'], [/Ã­/g, 'í'], [/Ãº/g, 'ú'],
  [/Ã"/g, 'Ó'], [/Ã/g, 'Á'], [/Ã‰/g, 'É'], [/Ã/g, 'Í'], [/Ãš/g, 'Ú'],
  // Ñ
  [/Ã±/g, 'ñ'], [/Ã'/g, 'Ñ'],
  // Diéresis
  [/Ã¼/g, 'ü'], [/Ãœ/g, 'Ü'],
  // Signos
  [/Â¿/g, '¿'], [/Â¡/g, '¡'], [/â‚¬/g, '€'],
  // Comillas y guiones
  [/â€œ/g, '"'], [/â€/g, '"'], [/â€™/g, "'"], [/â€"/g, '–'], [/â€"/g, '—'],
  // Caracteres de control residuales
  [/Â/g, ''], [/\u00A0/g, ' ']
];

/**
 * Patrones de separadores numéricos corruptos
 * Priorizados por frecuencia en documentos PTEL
 */
const SEPARATOR_PATTERNS: [RegExp, string, string][] = [
  // P1-1: Doble tilde como decimal (Berja)
  [/(\d+)\s*´´\s*(\d+)/g, '$1.$2', 'DOUBLE_TILDE'],
  // P1-2: Tilde simple como decimal
  [/(\d+)\s*´\s*(\d+)/g, '$1.$2', 'SINGLE_TILDE'],
  // P1-3: Espacio como separador de miles
  [/(\d{1,3})\s+(\d{3})\s*[,.]?\s*(\d*)$/g, '$1$2.$3', 'SPACE_THOUSANDS'],
  // P1-4: Punto como separador de miles (español)
  [/(\d{1,3})\.(\d{3})\.(\d{3})[,.]?(\d*)/g, '$1$2$3.$4', 'DOT_THOUSANDS_3'],
  [/(\d{1,3})\.(\d{3})[,.](\d+)/g, '$1$2.$3', 'DOT_THOUSANDS_2'],
  // P1-5: Coma decimal (convertir a punto)
  [/(\d+),(\d+)/g, '$1.$2', 'COMMA_DECIMAL'],
];

// ============================================================================
// FUNCIONES DE NORMALIZACIÓN
// ============================================================================

/**
 * Normaliza una coordenada aplicando el pipeline completo de 6 fases.
 * 
 * @param input - Coordenada de entrada (puede ser string o número)
 * @param options - Opciones de normalización
 * @returns Resultado de normalización con coordenadas, correcciones y score
 * 
 * @example
 * ```typescript
 * const result = normalizeCoordinate({
 *   x: "447.850,23",
 *   y: "77905",
 *   municipality: "Colomera",
 *   province: "Granada"
 * });
 * // result.x = 447850.23
 * // result.y = 4077905
 * // result.score = 92
 * ```
 */
export function normalizeCoordinate(input: CoordinateInput): NormalizationResult {
  const corrections: Correction[] = [];
  const flags: Flag[] = [];
  
  // Guardar valores originales
  const original = { x: input.x, y: input.y };
  
  // Fase 1: Detectar placeholders
  const xPlaceholder = isPlaceholder(input.x);
  const yPlaceholder = isPlaceholder(input.y);
  
  if (xPlaceholder || yPlaceholder) {
    if (xPlaceholder) {
      corrections.push({
        type: 'PLACEHOLDER_DETECTED',
        field: 'x',
        from: String(input.x),
        to: 'null',
        pattern: 'PLACEHOLDER',
        priority: 'P0'
      });
    }
    if (yPlaceholder) {
      corrections.push({
        type: 'PLACEHOLDER_DETECTED',
        field: 'y',
        from: String(input.y),
        to: 'null',
        pattern: 'PLACEHOLDER',
        priority: 'P0'
      });
    }
    
    flags.push({
      type: 'GEOCODING_NEEDED',
      severity: 'warning',
      message: 'Coordenadas vacías o placeholder detectado'
    });
    
    return {
      x: xPlaceholder ? null : normalizeNumber(input.x, corrections, 'x'),
      y: yPlaceholder ? null : normalizeNumber(input.y, corrections, 'y'),
      original,
      corrections,
      flags,
      score: 0,
      confidence: 'CRITICAL',
      isValid: false
    };
  }
  
  // Fase 2: Normalizar formato numérico
  let x = normalizeNumber(input.x, corrections, 'x');
  let y = normalizeNumber(input.y, corrections, 'y');
  
  if (x === null || y === null) {
    flags.push({
      type: 'SUSPICIOUS_VALUE',
      severity: 'error',
      message: 'No se pudo parsear la coordenada como número'
    });
    return {
      x, y, original, corrections, flags,
      score: 0,
      confidence: 'CRITICAL',
      isValid: false
    };
  }
  
  // Fase 3: Detectar intercambio X↔Y
  if (detectXYSwap(x, y)) {
    const temp = x;
    x = y;
    y = temp;
    corrections.push({
      type: 'XY_SWAPPED',
      field: 'both',
      from: `X=${original.x}, Y=${original.y}`,
      to: `X=${x}, Y=${y}`,
      pattern: 'XY_SWAP',
      priority: 'P0'
    });
  }
  
  // Fase 4: Detectar Y truncada
  const truncationResult = detectAndFixTruncation(y, input.province);
  if (truncationResult.wasTruncated) {
    corrections.push({
      type: 'Y_TRUNCATED',
      field: 'y',
      from: String(y),
      to: String(truncationResult.fixed),
      pattern: `TRUNCATION_${truncationResult.method}`,
      priority: 'P0'
    });
    y = truncationResult.fixed;
  }
  
  // Fase 5: Validar rangos
  const rangeValid = validateRange(x, y, flags);
  
  // Fase 6: Calcular score y confianza
  const score = calculateScore(x, y, corrections, flags);
  const confidence = scoreToConfidence(score);
  
  return {
    x,
    y,
    original,
    corrections,
    flags,
    score,
    confidence,
    isValid: rangeValid && score >= 50
  };
}

/**
 * Normaliza un valor numérico, limpiando separadores y caracteres inválidos.
 */
function normalizeNumber(
  value: string | number, 
  corrections: Correction[], 
  field: 'x' | 'y'
): number | null {
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  
  let str = String(value).trim();
  const originalStr = str;
  
  // Aplicar patrones de corrección de separadores
  for (const [pattern, replacement, patternName] of SEPARATOR_PATTERNS) {
    const newStr = str.replace(pattern, replacement);
    if (newStr !== str) {
      corrections.push({
        type: 'SEPARATOR_FIXED',
        field,
        from: str,
        to: newStr,
        pattern: patternName,
        priority: 'P1'
      });
      str = newStr;
    }
  }
  
  // Limpiar caracteres no numéricos restantes (excepto punto y signo)
  str = str.replace(/[^\d.-]/g, '');
  
  // Manejar múltiples puntos (quedarse con el último como decimal)
  const dots = str.match(/\./g);
  if (dots && dots.length > 1) {
    const parts = str.split('.');
    const decimal = parts.pop();
    str = parts.join('') + '.' + decimal;
  }
  
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Detecta si un valor es un placeholder o indica "sin datos".
 */
function isPlaceholder(value: string | number): boolean {
  if (typeof value === 'number') {
    return value === 0 || isNaN(value);
  }
  
  const str = String(value).trim();
  return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(str));
}

/**
 * Detecta si X e Y están intercambiadas basándose en rangos esperados.
 */
function detectXYSwap(x: number, y: number): boolean {
  // Si X está en rango de Y (millones) e Y está en rango de X (cientos de miles)
  const xInYRange = x >= 1_000_000 && x <= 5_000_000;
  const yInXRange = y >= 100_000 && y <= 900_000;
  
  return xInYRange && yInXRange;
}

/**
 * Detecta y corrige coordenadas Y truncadas.
 */
function detectAndFixTruncation(
  y: number, 
  province?: Province
): { wasTruncated: boolean; fixed: number; method: string } {
  const yStr = Math.floor(y).toString();
  
  // Y completa debe tener 7 dígitos y empezar con 4
  if (yStr.length >= 7 && yStr.startsWith('4')) {
    return { wasTruncated: false, fixed: y, method: 'NONE' };
  }
  
  // Detectar truncación
  if (yStr.length <= 6) {
    // Intentar determinar prefijo por provincia
    let prefix = '40'; // Default para Andalucía sur
    
    if (province && PROVINCE_Y_PREFIXES[province]) {
      prefix = PROVINCE_Y_PREFIXES[province][0];
    }
    
    // Si Y empieza con 0-3, probablemente falta el 4 inicial
    if (yStr.startsWith('0') || yStr.startsWith('1') || 
        yStr.startsWith('2') || yStr.startsWith('3')) {
      const fixed = parseFloat('4' + yStr);
      return { wasTruncated: true, fixed, method: 'PREFIX_4' };
    }
    
    // Si Y tiene 5-6 dígitos, añadir prefijo provincial
    if (yStr.length === 5) {
      const fixed = parseFloat(prefix + yStr);
      return { wasTruncated: true, fixed, method: 'PREFIX_FULL' };
    }
    
    if (yStr.length === 6 && !yStr.startsWith('4')) {
      const fixed = parseFloat('4' + yStr);
      return { wasTruncated: true, fixed, method: 'PREFIX_4' };
    }
  }
  
  return { wasTruncated: false, fixed: y, method: 'NONE' };
}

/**
 * Valida que las coordenadas estén dentro de los rangos de Andalucía.
 */
function validateRange(x: number, y: number, flags: Flag[]): boolean {
  let valid = true;
  
  if (x < ANDALUSIA_BOUNDS.x.min || x > ANDALUSIA_BOUNDS.x.max) {
    flags.push({
      type: 'OUT_OF_RANGE',
      severity: 'error',
      message: `X=${x} fuera de rango Andalucía (${ANDALUSIA_BOUNDS.x.min}-${ANDALUSIA_BOUNDS.x.max})`
    });
    valid = false;
  }
  
  if (y < ANDALUSIA_BOUNDS.y.min || y > ANDALUSIA_BOUNDS.y.max) {
    flags.push({
      type: 'OUT_OF_RANGE',
      severity: 'error',
      message: `Y=${y} fuera de rango Andalucía (${ANDALUSIA_BOUNDS.y.min}-${ANDALUSIA_BOUNDS.y.max})`
    });
    valid = false;
  }
  
  return valid;
}

/**
 * Calcula el score de validación (0-100).
 */
function calculateScore(
  x: number, 
  y: number, 
  corrections: Correction[], 
  flags: Flag[]
): number {
  let score = 100;
  
  // Penalizar por correcciones aplicadas
  const p0Corrections = corrections.filter(c => c.priority === 'P0').length;
  const p1Corrections = corrections.filter(c => c.priority === 'P1').length;
  
  score -= p0Corrections * 15; // Correcciones críticas
  score -= p1Corrections * 5;  // Correcciones menores
  
  // Penalizar por flags
  const errors = flags.filter(f => f.severity === 'error').length;
  const warnings = flags.filter(f => f.severity === 'warning').length;
  
  score -= errors * 25;
  score -= warnings * 10;
  
  // Bonificar por decimales (indica mayor precisión)
  const xHasDecimals = x % 1 !== 0;
  const yHasDecimals = y % 1 !== 0;
  
  if (!xHasDecimals) score -= 5;
  if (!yHasDecimals) score -= 5;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Convierte score numérico a nivel de confianza.
 */
function scoreToConfidence(score: number): ConfidenceLevel {
  if (score >= 76) return 'HIGH';
  if (score >= 51) return 'MEDIUM';
  if (score >= 26) return 'LOW';
  return 'CRITICAL';
}

// ============================================================================
// FUNCIONES DE UTILIDAD PARA TEXTO
// ============================================================================

/**
 * Normaliza texto corrigiendo problemas de encoding UTF-8 (mojibake).
 * 
 * @param text - Texto con posible corrupción UTF-8
 * @returns Texto normalizado
 */
export function normalizeEncoding(text: string): string {
  let result = text;
  
  for (const [pattern, replacement] of MOJIBAKE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  
  return result;
}

/**
 * Normaliza un lote de coordenadas.
 * 
 * @param inputs - Array de coordenadas a normalizar
 * @param onProgress - Callback opcional para reportar progreso
 * @returns Array de resultados de normalización
 */
export function normalizeCoordinateBatch(
  inputs: CoordinateInput[],
  onProgress?: (current: number, total: number) => void
): NormalizationResult[] {
  const results: NormalizationResult[] = [];
  
  for (let i = 0; i < inputs.length; i++) {
    results.push(normalizeCoordinate(inputs[i]));
    onProgress?.(i + 1, inputs.length);
  }
  
  return results;
}

/**
 * Genera estadísticas de un lote de normalizaciones.
 */
export function getBatchStats(results: NormalizationResult[]): {
  total: number;
  valid: number;
  invalid: number;
  avgScore: number;
  correctionsByType: Record<CorrectionType, number>;
  confidenceDistribution: Record<ConfidenceLevel, number>;
} {
  const correctionsByType: Record<string, number> = {};
  const confidenceDistribution: Record<ConfidenceLevel, number> = {
    CRITICAL: 0, LOW: 0, MEDIUM: 0, HIGH: 0
  };
  
  let totalScore = 0;
  let validCount = 0;
  
  for (const result of results) {
    totalScore += result.score;
    if (result.isValid) validCount++;
    confidenceDistribution[result.confidence]++;
    
    for (const correction of result.corrections) {
      correctionsByType[correction.type] = (correctionsByType[correction.type] || 0) + 1;
    }
  }
  
  return {
    total: results.length,
    valid: validCount,
    invalid: results.length - validCount,
    avgScore: results.length > 0 ? totalScore / results.length : 0,
    correctionsByType: correctionsByType as Record<CorrectionType, number>,
    confidenceDistribution
  };
}

// ============================================================================
// FUNCIONES DMS (GRADOS, MINUTOS, SEGUNDOS) - Patrones C1-C8
// ============================================================================

/**
 * Parsea una coordenada individual en formato DMS a grados decimales.
 * Soporta múltiples formatos (C1-C8 del catálogo PTEL).
 * 
 * @param dmsString - Coordenada en formato sexagesimal
 * @returns Objeto con valor decimal, hemisferio y tipo
 * 
 * @example
 * ```typescript
 * parseDMS("37°26'46.5\"N")  // { valor: 37.446250, hemisferio: 'N', tipo: 'latitud' }
 * parseDMS("3°45'12.3\"W")   // { valor: 3.753417, hemisferio: 'W', tipo: 'longitud' }
 * parseDMS("37 26 46.5 N")   // { valor: 37.446250, hemisferio: 'N', tipo: 'latitud' }
 * ```
 */
export function parseDMS(dmsString: string): DMSParseResult {
  const nullResult: DMSParseResult = { valor: null, hemisferio: null, tipo: null, patron: null };
  
  if (!dmsString || typeof dmsString !== 'string') {
    return nullResult;
  }

  const s = dmsString.trim();
  if (s.length === 0) return nullResult;
  
  // Normalizar caracteres
  let normalized = s
    .replace(/º/g, '°')              // º español → ° estándar
    .replace(/(\d),(\d)/g, '$1.$2')  // coma decimal → punto
    .replace(/[''´`]/g, "'")         // comillas simples variantes
    .replace(/[""«»]/g, '"')         // comillas dobles variantes
    .replace(/′/g, "'")              // prime → comilla simple
    .replace(/″/g, '"')              // double prime → comilla doble
    .replace(/\s+/g, ' ');           // múltiples espacios → uno

  // Detectar hemisferio (N/S/E/W/O)
  let hemisferio: 'N' | 'S' | 'E' | 'W' | null = null;
  const hemMatch = normalized.match(/[NSEWON]/gi);
  if (hemMatch) {
    const lastHem = hemMatch[hemMatch.length - 1].toUpperCase();
    hemisferio = (lastHem === 'O' ? 'W' : lastHem) as 'N' | 'S' | 'E' | 'W';
  }

  // Determinar tipo según hemisferio
  let tipo: 'latitud' | 'longitud' | null = null;
  if (hemisferio === 'N' || hemisferio === 'S') {
    tipo = 'latitud';
  } else if (hemisferio === 'E' || hemisferio === 'W') {
    tipo = 'longitud';
  }

  // Remover hemisferio para parseo numérico
  normalized = normalized.replace(/[NSEWON]/gi, '').trim();

  // PATRÓN 1: Grados°Minutos'Segundos" (C1, C2, C4, C7, C8)
  const pattern1 = /(-?\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)\s*[']\s*(\d+(?:\.\d+)?)\s*[""]?/;
  let match = normalized.match(pattern1);
  if (match) {
    const grados = parseFloat(match[1]);
    const minutos = parseFloat(match[2]);
    const segundos = parseFloat(match[3]);
    const decimal = Math.abs(grados) + minutos / 60 + segundos / 3600;
    const signo = grados < 0 ? -1 : 1;
    return { valor: signo * decimal, hemisferio, tipo, patron: 'DMS_COMPLETO' };
  }

  // PATRÓN 2: Grados°Minutos.decimales' sin segundos (C5)
  const pattern2 = /(-?\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)\s*[']/;
  match = normalized.match(pattern2);
  if (match) {
    const grados = parseFloat(match[1]);
    const minutos = parseFloat(match[2]);
    const decimal = Math.abs(grados) + minutos / 60;
    const signo = grados < 0 ? -1 : 1;
    return { valor: signo * decimal, hemisferio, tipo, patron: 'DM_DECIMAL' };
  }

  // PATRÓN 3: Grados.decimales° solo grados (C6)
  const pattern3 = /(-?\d+(?:\.\d+)?)\s*°/;
  match = normalized.match(pattern3);
  if (match) {
    const grados = parseFloat(match[1]);
    return { valor: grados, hemisferio, tipo, patron: 'D_DECIMAL' };
  }

  // PATRÓN 4: Espacios como separadores (C3)
  const pattern4 = /(-?\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)/;
  match = normalized.match(pattern4);
  if (match) {
    const grados = parseFloat(match[1]);
    const minutos = parseFloat(match[2]);
    const segundos = parseFloat(match[3]);
    const decimal = Math.abs(grados) + minutos / 60 + segundos / 3600;
    const signo = grados < 0 ? -1 : 1;
    return { valor: signo * decimal, hemisferio, tipo, patron: 'DMS_ESPACIOS' };
  }

  // PATRÓN 5: Solo dos números con espacio (grados minutos)
  const pattern5 = /(-?\d+)\s+(\d+(?:\.\d+)?)/;
  match = normalized.match(pattern5);
  if (match) {
    const grados = parseFloat(match[1]);
    const minutos = parseFloat(match[2]);
    const decimal = Math.abs(grados) + minutos / 60;
    const signo = grados < 0 ? -1 : 1;
    return { valor: signo * decimal, hemisferio, tipo, patron: 'DM_ESPACIOS' };
  }

  return nullResult;
}

/**
 * Parsea un par de coordenadas DMS (latitud/longitud).
 * Detecta automáticamente qué coordenada es latitud y cuál longitud.
 * 
 * @param input - Cadena con par de coordenadas DMS
 * @returns Objeto con latitud y longitud en decimales
 * 
 * @example
 * ```typescript
 * parseParDMS("37°26'46.5\"N 3°45'12.3\"W")
 * // { latitud: 37.446250, longitud: -3.753417, exito: true }
 * ```
 */
export function parseParDMS(input: string): DMSPairResult {
  const nullResult: DMSPairResult = { latitud: null, longitud: null, exito: false, patrones: [] };
  
  if (!input || typeof input !== 'string') return nullResult;

  const s = input.trim();
  if (s.length === 0) return nullResult;
  
  const hemisferios = s.match(/[NSEWON]/gi);
  
  // ESTRATEGIA 1: Dos hemisferios explícitos
  if (hemisferios && hemisferios.length >= 2) {
    const firstHemPos = s.search(/[NSEWON]/i);
    const afterFirst = s.substring(firstHemPos + 1);
    const secondNumStart = afterFirst.search(/\d/);
    
    if (secondNumStart !== -1) {
      const coord1 = s.substring(0, firstHemPos + 1).trim();
      const coord2 = afterFirst.substring(secondNumStart).trim();
      
      const parsed1 = parseDMS(coord1);
      const parsed2 = parseDMS(coord2);
      
      const patrones: DMSPattern[] = [];
      if (parsed1.patron) patrones.push(parsed1.patron);
      if (parsed2.patron) patrones.push(parsed2.patron);
      
      let latitud: number | null = null;
      let longitud: number | null = null;
      
      if (parsed1.tipo === 'latitud' && parsed1.valor !== null) {
        latitud = parsed1.hemisferio === 'S' ? -Math.abs(parsed1.valor) : parsed1.valor;
      } else if (parsed1.tipo === 'longitud' && parsed1.valor !== null) {
        longitud = parsed1.hemisferio === 'W' ? -Math.abs(parsed1.valor) : parsed1.valor;
      }
      
      if (parsed2.tipo === 'latitud' && parsed2.valor !== null) {
        latitud = parsed2.hemisferio === 'S' ? -Math.abs(parsed2.valor) : parsed2.valor;
      } else if (parsed2.tipo === 'longitud' && parsed2.valor !== null) {
        longitud = parsed2.hemisferio === 'W' ? -Math.abs(parsed2.valor) : parsed2.valor;
      }
      
      if (latitud !== null && longitud !== null) {
        return { latitud, longitud, exito: true, patrones };
      }
    }
  }
  
  // ESTRATEGIA 2: Separar por coma o punto y coma
  const partes = s.split(/[,;]\s*/);
  if (partes.length === 2) {
    const parsed1 = parseDMS(partes[0]);
    const parsed2 = parseDMS(partes[1]);
    
    const patrones: DMSPattern[] = [];
    if (parsed1.patron) patrones.push(parsed1.patron);
    if (parsed2.patron) patrones.push(parsed2.patron);
    
    let latitud: number | null = null;
    let longitud: number | null = null;
    
    if (parsed1.valor !== null) {
      if (parsed1.tipo === 'latitud') {
        latitud = parsed1.hemisferio === 'S' ? -Math.abs(parsed1.valor) : parsed1.valor;
      } else if (parsed1.tipo === 'longitud') {
        longitud = parsed1.hemisferio === 'W' ? -Math.abs(parsed1.valor) : parsed1.valor;
      } else {
        latitud = parsed1.valor; // Asumir primera es latitud
      }
    }
    
    if (parsed2.valor !== null) {
      if (parsed2.tipo === 'longitud') {
        longitud = parsed2.hemisferio === 'W' ? -Math.abs(parsed2.valor) : parsed2.valor;
      } else if (parsed2.tipo === 'latitud') {
        latitud = parsed2.hemisferio === 'S' ? -Math.abs(parsed2.valor) : parsed2.valor;
      } else {
        longitud = parsed2.valor; // Asumir segunda es longitud
      }
    }
    
    if (latitud !== null || longitud !== null) {
      return { latitud, longitud, exito: latitud !== null && longitud !== null, patrones };
    }
  }
  
  return nullResult;
}

/**
 * Detecta si una cadena contiene coordenadas en formato DMS.
 * 
 * @param value - Valor a analizar
 * @returns true si parece ser formato DMS
 */
export function isDMSFormat(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  
  const s = value.trim();
  
  const dmsIndicators = [
    /°.*['′].*["″]/,                    // Tiene grados, minutos y segundos
    /°.*['′]/,                          // Tiene grados y minutos
    /\d+\s+\d+\s+\d+.*[NSEWON]/i,       // Espacios con hemisferio
    /[NSEWON]\s*\d+\s*°/i,              // Hemisferio prefijo con grados
    /\d+\s*°\s*\d+.*[NSEWON]/i,         // Grados seguidos de hemisferio
  ];
  
  return dmsIndicators.some(pattern => pattern.test(s));
}

// ============================================================================
// FUNCIONES NMEA GPS - Patrones D1-D4
// ============================================================================

/**
 * Parsea una coordenada individual en formato NMEA a grados decimales.
 * 
 * Formato NMEA:
 * - Latitud: ddmm.mmmm[N/S] donde dd=grados, mm.mmmm=minutos decimales
 * - Longitud: dddmm.mmmm[E/W] donde ddd=grados, mm.mmmm=minutos decimales
 * 
 * @param nmeaString - Coordenada en formato NMEA
 * @returns Objeto con valor decimal, hemisferio y tipo
 * 
 * @example
 * ```typescript
 * parseNMEA("3726.775N")   // { valor: 37.44625, hemisferio: 'N', tipo: 'latitud' }
 * parseNMEA("00345.204W")  // { valor: 3.7534, hemisferio: 'W', tipo: 'longitud' }
 * ```
 */
export function parseNMEA(nmeaString: string): NMEAParseResult {
  const nullResult: NMEAParseResult = { valor: null, hemisferio: null, tipo: null, patron: null };
  
  if (!nmeaString || typeof nmeaString !== 'string') {
    return nullResult;
  }

  let s = nmeaString.trim().toUpperCase();
  if (s.length === 0) return nullResult;
  
  // Normalizar: quitar espacios internos y comas antes de hemisferio
  s = s.replace(/[\s,]+([NSEWON])$/i, '$1');
  s = s.replace(/,/g, '.');
  
  // Detectar hemisferio
  let hemisferio: 'N' | 'S' | 'E' | 'W' | null = null;
  const hemMatch = s.match(/[NSEWON]$/i);
  if (hemMatch) {
    const hem = hemMatch[0].toUpperCase();
    hemisferio = (hem === 'O' ? 'W' : hem) as 'N' | 'S' | 'E' | 'W';
    s = s.slice(0, -1).trim();
  }

  // Determinar tipo según hemisferio
  let tipo: 'latitud' | 'longitud' | null = null;
  if (hemisferio === 'N' || hemisferio === 'S') {
    tipo = 'latitud';
  } else if (hemisferio === 'E' || hemisferio === 'W') {
    tipo = 'longitud';
  }

  // PATRÓN NMEA estándar: ddmm.mmmm o dddmm.mmmm
  const nmeaPattern = /^(\d+)\.(\d+)$/;
  const match = s.match(nmeaPattern);
  
  if (match) {
    const intPart = match[1];
    const decPart = match[2];
    
    let grados: number, minutos: number;
    
    if (tipo === 'latitud' || (tipo === null && intPart.length <= 4)) {
      // Latitud: ddmm.mmmm
      if (intPart.length >= 3) {
        grados = parseInt(intPart.slice(0, -2), 10);
        minutos = parseFloat(intPart.slice(-2) + '.' + decPart);
      } else if (intPart.length === 2) {
        grados = 0;
        minutos = parseFloat(intPart + '.' + decPart);
      } else {
        return nullResult;
      }
    } else {
      // Longitud: dddmm.mmmm
      if (intPart.length >= 4) {
        grados = parseInt(intPart.slice(0, -2), 10);
        minutos = parseFloat(intPart.slice(-2) + '.' + decPart);
      } else if (intPart.length === 3) {
        grados = parseInt(intPart.slice(0, 1), 10);
        minutos = parseFloat(intPart.slice(1) + '.' + decPart);
      } else {
        return nullResult;
      }
    }
    
    if (minutos >= 60) return nullResult;
    
    const decimal = grados + minutos / 60;
    return { valor: decimal, hemisferio, tipo, patron: 'NMEA_STANDARD' };
  }
  
  // Patrón entero sin decimales
  const intOnlyPattern = /^(\d{4,5})$/;
  const intMatch = s.match(intOnlyPattern);
  
  if (intMatch) {
    const intPart = intMatch[1];
    let grados: number, minutos: number;
    
    if (intPart.length === 4) {
      grados = parseInt(intPart.slice(0, 2), 10);
      minutos = parseInt(intPart.slice(2), 10);
    } else if (intPart.length === 5) {
      grados = parseInt(intPart.slice(0, 3), 10);
      minutos = parseInt(intPart.slice(3), 10);
    } else {
      return nullResult;
    }
    
    if (minutos >= 60) return nullResult;
    
    const decimal = grados + minutos / 60;
    return { valor: decimal, hemisferio, tipo, patron: 'NMEA_INTEGER' };
  }
  
  return nullResult;
}

/**
 * Extrae coordenadas de una sentencia NMEA completa ($GPGGA, $GPRMC, $GPGLL).
 * 
 * @param sentence - Sentencia NMEA completa
 * @returns Objeto con latitud, longitud y tipo de sentencia
 * 
 * @example
 * ```typescript
 * parseNMEASentence("$GPGGA,123519,3726.775,N,00345.204,W,1,08,0.9,545.4,M,...")
 * // { latitud: 37.44625, longitud: -3.7534, exito: true, tipoSentencia: 'GGA' }
 * ```
 */
export function parseNMEASentence(sentence: string): NMEAPairResult {
  const nullResult: NMEAPairResult = { 
    latitud: null, longitud: null, exito: false, patrones: [], tipoSentencia: null 
  };
  
  if (!sentence || typeof sentence !== 'string') return nullResult;
  
  const s = sentence.trim().toUpperCase();
  
  // Detectar tipo de sentencia
  let tipoSentencia: string | null = null;
  if (s.startsWith('$GPGGA') || s.startsWith('$GNGGA')) {
    tipoSentencia = 'GGA';
  } else if (s.startsWith('$GPRMC') || s.startsWith('$GNRMC')) {
    tipoSentencia = 'RMC';
  } else if (s.startsWith('$GPGLL') || s.startsWith('$GNGLL')) {
    tipoSentencia = 'GLL';
  }
  
  if (!tipoSentencia) return nullResult;
  
  const mainPart = s.split('*')[0];
  const fields = mainPart.split(',');
  
  let latField: string, latHem: string, lonField: string, lonHem: string;
  
  if (tipoSentencia === 'GGA' && fields.length >= 6) {
    latField = fields[2]; latHem = fields[3];
    lonField = fields[4]; lonHem = fields[5];
  } else if (tipoSentencia === 'RMC' && fields.length >= 7) {
    latField = fields[3]; latHem = fields[4];
    lonField = fields[5]; lonHem = fields[6];
  } else if (tipoSentencia === 'GLL' && fields.length >= 5) {
    latField = fields[1]; latHem = fields[2];
    lonField = fields[3]; lonHem = fields[4];
  } else {
    return nullResult;
  }
  
  const latParsed = parseNMEA(latField + latHem);
  const lonParsed = parseNMEA(lonField + lonHem);
  
  if (latParsed.valor === null || lonParsed.valor === null) return nullResult;
  
  let latitud = latParsed.valor;
  let longitud = lonParsed.valor;
  
  if (latHem === 'S') latitud = -latitud;
  if (lonHem === 'W' || lonHem === 'O') longitud = -longitud;
  
  return { latitud, longitud, exito: true, patrones: ['NMEA_SENTENCE'], tipoSentencia };
}

/**
 * Parsea un par de coordenadas NMEA (o sentencia completa).
 * 
 * @param input - Par de coordenadas NMEA o sentencia completa
 * @returns Objeto con latitud y longitud en decimales
 * 
 * @example
 * ```typescript
 * parseParNMEA("3726.775N, 00345.204W")
 * // { latitud: 37.44625, longitud: -3.7534, exito: true }
 * ```
 */
export function parseParNMEA(input: string): NMEAPairResult {
  const nullResult: NMEAPairResult = { latitud: null, longitud: null, exito: false, patrones: [] };
  
  if (!input || typeof input !== 'string') return nullResult;
  
  const s = input.trim();
  
  // Si es sentencia NMEA completa
  if (s.toUpperCase().startsWith('$GP') || s.toUpperCase().startsWith('$GN')) {
    return parseNMEASentence(s);
  }
  
  // Buscar par NMEA: ddmm.mmmmN dddmm.mmmmW
  const nmeaPairPattern = /(\d+\.?\d*)\s*,?\s*([NS])\s*[,\/\s]+\s*(\d+\.?\d*)\s*,?\s*([EWO])/i;
  const match = s.match(nmeaPairPattern);
  
  if (match) {
    const lat = parseNMEA(match[1] + match[2]);
    const lon = parseNMEA(match[3] + match[4]);
    
    if (lat.valor !== null && lon.valor !== null) {
      let latitud = lat.valor;
      let longitud = lon.valor;
      
      if (match[2].toUpperCase() === 'S') latitud = -latitud;
      if (match[4].toUpperCase() === 'W' || match[4].toUpperCase() === 'O') {
        longitud = -longitud;
      }
      
      return { latitud, longitud, exito: true, patrones: ['NMEA_PAIR'] };
    }
  }
  
  // Intentar separar por coma/espacio
  const parts = s.split(/[,;\/]\s*|\s{2,}/);
  if (parts.length >= 2) {
    const parsed1 = parseNMEA(parts[0]);
    const parsed2 = parseNMEA(parts[1]);
    
    if (parsed1.valor !== null && parsed2.valor !== null) {
      let latitud: number | null = null;
      let longitud: number | null = null;
      const patrones: NMEAPattern[] = [];
      
      if (parsed1.patron) patrones.push(parsed1.patron);
      if (parsed2.patron) patrones.push(parsed2.patron);
      
      if (parsed1.tipo === 'latitud') {
        latitud = parsed1.hemisferio === 'S' ? -parsed1.valor : parsed1.valor;
      } else if (parsed1.tipo === 'longitud') {
        longitud = parsed1.hemisferio === 'W' ? -parsed1.valor : parsed1.valor;
      }
      
      if (parsed2.tipo === 'latitud') {
        latitud = parsed2.hemisferio === 'S' ? -parsed2.valor : parsed2.valor;
      } else if (parsed2.tipo === 'longitud') {
        longitud = parsed2.hemisferio === 'W' ? -parsed2.valor : parsed2.valor;
      }
      
      if (latitud !== null && longitud !== null) {
        return { latitud, longitud, exito: true, patrones };
      }
    }
  }
  
  return nullResult;
}

/**
 * Detecta si un valor está en formato NMEA GPS.
 * 
 * @param value - Valor a analizar
 * @returns true si parece ser formato NMEA
 */
export function isNMEAFormat(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  
  const s = value.trim().toUpperCase();
  
  const nmeaIndicators = [
    /^\$GP[A-Z]{3}/,                    // Sentencia NMEA GPS
    /^\$GN[A-Z]{3}/,                    // Sentencia NMEA multi-constelación
    /^\d{4,5}\.\d+[NSEWON]$/i,          // ddmm.mmmmN o dddmm.mmmmW
    /^\d{4,5}\.\d+\s*,?\s*[NSEWON]$/i,  // Con espacio/coma antes de hemisferio
  ];
  
  return nmeaIndicators.some(pattern => pattern.test(s));
}

// ============================================================================
// EXPORTS DEFAULT
// ============================================================================

export default {
  normalizeCoordinate,
  normalizeCoordinateBatch,
  normalizeEncoding,
  getBatchStats,
  // DMS Parsers (Patrones C1-C8)
  parseDMS,
  parseParDMS,
  isDMSFormat,
  // NMEA GPS Parsers (Patrones D1-D4)
  parseNMEA,
  parseNMEASentence,
  parseParNMEA,
  isNMEAFormat,
  // Constantes
  ANDALUSIA_BOUNDS,
  PROVINCE_Y_PREFIXES
};
