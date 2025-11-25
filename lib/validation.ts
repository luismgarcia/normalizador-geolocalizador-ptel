import { CoordinateData } from './types'

export const VALIDATION_STRATEGIES = [
  {
    name: 'Rango UTM30 Andalucía',
    maxPoints: 15,
    description: 'X: 160,000 - 770,000 metros · Y: 3,960,000 - 4,280,000 metros',
    icon: 'MapPin',
    evaluate: (coord: CoordinateData) => {
      const inRangeX = coord.utm30_x >= 160000 && coord.utm30_x <= 770000
      const inRangeY = coord.utm30_y >= 3960000 && coord.utm30_y <= 4280000
      
      if (inRangeX && inRangeY) {
        return { points: 15 }
      } else {
        return { 
          points: 0, 
          alert: '⚠️ Coordenadas fuera del rango típico de Andalucía' 
        }
      }
    }
  },
  {
    name: 'Caracteres Especiales',
    maxPoints: 10,
    description: 'Detecta: espacios (separadores de miles), ´´, ÌÌ, "", comillas raras',
    icon: 'Warning',
    evaluate: (coord: CoordinateData) => {
      const xStr = String(coord.originalX)
      const yStr = String(coord.originalY)
      
      const hasSpaces = /\s/.test(xStr) || /\s/.test(yStr)
      const hasSpecialChars = /[´Ì""]/g.test(xStr) || /[´Ì""]/g.test(yStr)
      
      if (hasSpaces || hasSpecialChars) {
        const type = hasSpaces ? 'separadores de miles europeos' : 'caracteres especiales'
        return { 
          points: 5, 
          alert: `⚠️ Contenía ${type} normalizados automáticamente` 
        }
      } else {
        return { points: 10 }
      }
    }
  },
  {
    name: 'Posición Decimal',
    maxPoints: 15,
    description: 'Verifica precisión submétrica correcta',
    icon: 'CheckCircle',
    evaluate: (coord: CoordinateData) => {
      const xDecimals = (coord.utm30_x.toString().split('.')[1] || '').length
      const yDecimals = (coord.utm30_y.toString().split('.')[1] || '').length
      
      if (xDecimals >= 1 && xDecimals <= 3 && yDecimals >= 1 && yDecimals <= 3) {
        return { points: 15 }
      } else if (xDecimals > 3 || yDecimals > 3) {
        return { 
          points: 8, 
          alert: '⚠️ Excesivos decimales (posible error de formato)' 
        }
      } else {
        return { points: 5 }
      }
    }
  },
  {
    name: 'Longitud de Dígitos',
    maxPoints: 10,
    description: 'X típico: 6 dígitos (UTM30) · Y típico: 7 dígitos',
    icon: 'NumberCircleOne',
    evaluate: (coord: CoordinateData) => {
      const xDigits = Math.floor(Math.abs(coord.utm30_x)).toString().length
      const yDigits = Math.floor(Math.abs(coord.utm30_y)).toString().length
      
      if (xDigits === 6 && yDigits === 7) {
        return { points: 10 }
      } else if (Math.abs(xDigits - 6) <= 1 && Math.abs(yDigits - 7) <= 1) {
        return { points: 7 }
      } else {
        return { 
          points: 3, 
          alert: '⚠️ Longitud de dígitos inusual para UTM30' 
        }
      }
    }
  },
  {
    name: 'Detección Transposición',
    maxPoints: 10,
    description: 'Detecta X ↔ Y intercambiados',
    icon: 'ArrowsClockwise',
    evaluate: (coord: CoordinateData) => {
      const xDigits = Math.floor(Math.abs(coord.utm30_x)).toString().length
      const yDigits = Math.floor(Math.abs(coord.utm30_y)).toString().length
      
      const xLooksLikeY = xDigits === 7 && yDigits === 6
      
      if (xLooksLikeY) {
        return { 
          points: 0, 
          alert: '⚠️ Posible transposición X ↔ Y detectada' 
        }
      } else {
        return { points: 10 }
      }
    }
  },
  {
    name: 'Coherencia Formato',
    maxPoints: 10,
    description: 'Valida confianza en detección de sistema',
    icon: 'CheckCircle',
    evaluate: (coord: CoordinateData) => {
      const confidence = coord.detectedSystemConfidence
      
      if (confidence > 0.9) {
        return { points: 10 }
      } else if (confidence > 0.7) {
        return { 
          points: 7, 
          alert: 'ℹ️ Detección de sistema con confianza media' 
        }
      } else {
        return { 
          points: 4, 
          alert: '⚠️ Detección de sistema con baja confianza' 
        }
      }
    }
  },
  {
    name: 'Validación EPSG',
    maxPoints: 10,
    description: 'Verifica conversión válida a EPSG:25830',
    icon: 'Globe',
    evaluate: (coord: CoordinateData) => {
      const conversionValid = 
        !isNaN(coord.utm30_x) && 
        !isNaN(coord.utm30_y) &&
        isFinite(coord.utm30_x) &&
        isFinite(coord.utm30_y)
      
      if (conversionValid) {
        return { points: 10 }
      } else {
        return { 
          points: 0, 
          alert: '❌ Error en conversión a UTM30' 
        }
      }
    }
  },
  {
    name: 'Proximidad Vecinos',
    maxPoints: 20,
    description: 'Calcula distancia a vecinos más cercanos · Umbral: 20 km',
    icon: 'Stack',
    evaluate: (coord: CoordinateData, allCoords: CoordinateData[]) => {
      const neighbors = allCoords.filter(c => c.index !== coord.index)
      
      if (neighbors.length === 0) {
        return { 
          points: 10, 
          alert: 'ℹ️ No hay vecinos para validación espacial' 
        }
      }
      
      const distances = neighbors.map(neighbor => {
        const dx = coord.utm30_x - neighbor.utm30_x
        const dy = coord.utm30_y - neighbor.utm30_y
        return Math.sqrt(dx * dx + dy * dy) / 1000
      })
      
      const minDistance = Math.min(...distances)
      
      if (minDistance <= 5) {
        return { points: 20 }
      } else if (minDistance <= 10) {
        return { points: 15 }
      } else if (minDistance <= 20) {
        return { points: 10 }
      } else {
        return { 
          points: 0, 
          alert: `⚠️ Coordenada aislada (${minDistance.toFixed(1)} km del vecino más cercano)` 
        }
      }
    }
  }
]

export function calculateScore(coord: CoordinateData, allCoords: CoordinateData[]): { score: number; alerts: string[] } {
  let totalScore = 0
  const alerts: string[] = []
  
  for (const strategy of VALIDATION_STRATEGIES) {
    const result = strategy.evaluate(coord, allCoords)
    totalScore += result.points
    
    if (result.alert) {
      alerts.push(result.alert)
    }
  }
  
  return { score: totalScore, alerts }
}

export function classifyConfidence(score: number): 'CRÍTICA' | 'ALTA' | 'MEDIA' | 'BAJA' | 'NULA' {
  if (score >= 95) return 'CRÍTICA'
  if (score >= 80) return 'ALTA'
  if (score >= 60) return 'MEDIA'
  if (score >= 40) return 'BAJA'
  return 'NULA'
}

export function getConfidenceColor(confidence: 'CRÍTICA' | 'ALTA' | 'MEDIA' | 'BAJA' | 'NULA' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL'): string {
  switch (confidence) {
    case 'CRÍTICA':
    case 'HIGH':
      return 'bg-purple-100 text-purple-900 border-purple-300'
    case 'ALTA':
      return 'bg-success/20 text-success-foreground border-success/30'
    case 'MEDIA':
    case 'MEDIUM':
      return 'bg-warning/20 text-warning-foreground border-warning/30'
    case 'BAJA':
    case 'LOW':
      return 'bg-orange-500/20 text-orange-900 border-orange-500/30'
    case 'NULA':
    case 'CRITICAL':
      return 'bg-destructive/20 text-destructive-foreground border-destructive/30'
  }
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success'
  if (score >= 60) return 'text-warning-foreground'
  if (score >= 40) return 'text-orange-600'
  return 'text-destructive'
}

export function getScoreGradient(score: number): string {
  if (score >= 80) return 'from-success/30 to-success'
  if (score >= 60) return 'from-warning/30 to-warning'
  if (score >= 40) return 'from-orange-400/30 to-orange-600'
  return 'from-destructive/30 to-destructive'
}
