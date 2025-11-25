function calculateDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
}

export interface GeographicValidationResult {
  index: number
  nombre: string
  x: number
  y: number
  alerts: string[]
  score: number
  nearestNeighborDistance: number
  isGeographicOutlier: boolean
}

export interface ValidateGeographicOptions {
  maxDistance?: number
  municipio?: string
}

export function validateGeographicCoherence(
  coords: Array<{ x: number; y: number; nombre: string }>,
  options: ValidateGeographicOptions = {}
): GeographicValidationResult[] {
  const maxDistance = options.maxDistance || 20000

  return coords.map((coord, index) => {
    const alerts: string[] = []
    let score = 100

    const neighbors = coords.filter((_, i) => i !== index)

    if (neighbors.length === 0) {
      return {
        index,
        nombre: coord.nombre,
        x: coord.x,
        y: coord.y,
        alerts: ['ℹ️ Elemento único, no se puede validar proximidad espacial'],
        score: 100,
        nearestNeighborDistance: 0,
        isGeographicOutlier: false
      }
    }

    const distances = neighbors.map(n =>
      calculateDistance(coord.x, coord.y, n.x, n.y)
    )

    const nearestDistance = Math.min(...distances)
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length

    if (nearestDistance > maxDistance) {
      const distanceKm = (nearestDistance / 1000).toFixed(1)
      alerts.push(
        `🚨 ERROR GEOGRÁFICO CRÍTICO: Elemento a ${distanceKm}km del más cercano (máximo permitido: ${maxDistance / 1000}km)`
      )
      score -= 40
    } else if (nearestDistance > maxDistance * 0.5) {
      const distanceKm = (nearestDistance / 1000).toFixed(1)
      alerts.push(
        `⚠️ Advertencia: Elemento a ${distanceKm}km del más cercano`
      )
      score -= 15
    }

    if (avgDistance > maxDistance * 1.5 && neighbors.length > 3) {
      alerts.push(
        `⚠️ Posible cluster aislado: distancia promedio ${(avgDistance / 1000).toFixed(1)}km`
      )
      score -= 10
    }

    return {
      index,
      nombre: coord.nombre,
      x: coord.x,
      y: coord.y,
      alerts,
      score: Math.max(0, score),
      nearestNeighborDistance: nearestDistance,
      isGeographicOutlier: nearestDistance > maxDistance
    }
  })
}

export function identifyGeographicClusters(
  coords: Array<{ x: number; y: number }>,
  maxClusterDistance: number = 20000
): Array<Array<number>> {
  if (coords.length === 0) return []

  const clusters: Array<Array<number>> = []
  const assigned = new Set<number>()

  for (let i = 0; i < coords.length; i++) {
    if (assigned.has(i)) continue

    const cluster = [i]
    assigned.add(i)

    const queue = [i]
    while (queue.length > 0) {
      const current = queue.shift()!

      for (let j = 0; j < coords.length; j++) {
        if (assigned.has(j)) continue

        const distance = calculateDistance(
          coords[current].x,
          coords[current].y,
          coords[j].x,
          coords[j].y
        )

        if (distance <= maxClusterDistance) {
          cluster.push(j)
          assigned.add(j)
          queue.push(j)
        }
      }
    }

    clusters.push(cluster)
  }

  return clusters
}

export interface GeographicReport {
  totalElements: number
  outliers: number
  averageNearestDistance: number
  maxDistance: number
  hasGeographicIssues: boolean
}

export function generateGeographicReport(
  validationResults: GeographicValidationResult[]
): GeographicReport {
  const outliers = validationResults.filter(r => r.isGeographicOutlier).length

  const distances = validationResults
    .filter(r => r.nearestNeighborDistance > 0)
    .map(r => r.nearestNeighborDistance)

  const avgDistance = distances.length > 0
    ? distances.reduce((a, b) => a + b, 0) / distances.length
    : 0

  const maxDistance = distances.length > 0
    ? Math.max(...distances)
    : 0

  return {
    totalElements: validationResults.length,
    outliers,
    averageNearestDistance: avgDistance,
    maxDistance,
    hasGeographicIssues: outliers > 0 || maxDistance > 50000
  }
}
