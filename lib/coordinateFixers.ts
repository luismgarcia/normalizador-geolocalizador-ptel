export interface CoordinateFixResult {
  x: number
  y: number
  fixed: boolean
  confidence: number
  reason?: string
}

export interface TruncationPatternResult {
  hasTruncation: boolean
  affectedCount: number
  estimatedPrefix: number
}

export function autoFixTruncatedY(
  x: number,
  y: number,
  provincia?: string
): CoordinateFixResult {
  if (y < 300000 && y > 100000 && x > 400000 && x < 650000) {
    const prefixMap: Record<string, number> = {
      'Almería': 4050000,
      'Granada': 4100000,
      'Jaén': 4180000,
      'Córdoba': 4200000,
      'Sevilla': 4120000,
      'Huelva': 4140000,
      'Cádiz': 4000000,
      'Málaga': 4050000
    }

    const prefix = provincia && prefixMap[provincia]
      ? prefixMap[provincia]
      : 4000000

    const yFixed = prefix + y

    if (yFixed >= 3950000 && yFixed <= 4300000) {
      return {
        x,
        y: yFixed,
        fixed: true,
        confidence: provincia ? 0.95 : 0.75,
        reason: `Y truncada corregida: ${y} → ${yFixed}${provincia ? ` (provincia: ${provincia})` : ''}`
      }
    }
  }

  return { x, y, fixed: false, confidence: 1.0 }
}

export function detectTruncationPattern(
  coordinates: Array<{ x: number; y: number }>
): TruncationPatternResult {
  let truncatedCount = 0
  const yValues: number[] = []

  for (const coord of coordinates) {
    if (coord.y < 300000 && coord.y > 100000) {
      truncatedCount++
      yValues.push(coord.y)
    }
  }

  let estimatedPrefix = 4000000
  if (yValues.length > 0) {
    const avgX = coordinates.reduce((sum, c) => sum + c.x, 0) / coordinates.length

    if (avgX < 450000) estimatedPrefix = 4000000
    else if (avgX < 550000) estimatedPrefix = 4100000
    else estimatedPrefix = 4050000
  }

  return {
    hasTruncation: truncatedCount > 0,
    affectedCount: truncatedCount,
    estimatedPrefix
  }
}
