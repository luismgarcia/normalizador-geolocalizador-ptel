export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL'

export interface CorrectionDetail {
  type: string
  pattern: string
  from: string | number
  to: string | number
}

export interface CoordinateData {
  index: number
  originalX: string | number
  originalY: string | number
  normalizedX: number
  normalizedY: number
  utm30_x: number
  utm30_y: number
  wgs84_lon: number
  wgs84_lat: number
  score: number
  confidence: 'CRÍTICA' | 'ALTA' | 'MEDIA' | 'BAJA' | 'NULA' | ConfidenceLevel
  alerts: string[]
  detectedSystem: string
  detectedSystemConfidence: number
  autoFixed?: boolean
  fixConfidence?: number
  fixReason?: string
  hadUTF8Corruption?: boolean
  corrections?: CorrectionDetail[]
  geographicValidation?: {
    nearestDistance: number
    isOutlier: boolean
  }
  [key: string]: any
}

export interface ProcessedFile {
  id: string
  name: string
  originalName: string
  type: string
  detectedSystem: string
  rowCount: number
  xColumn: string
  yColumn: string
  originalBounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
  utm30Bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
  averageScore: number
  coordinates: CoordinateData[]
  highConfidence: number
  mediumConfidence: number
  lowConfidence: number
  rejected: number
  originalColumns: string[]
  rawData: any[]
}

export interface ValidationStrategy {
  name: string
  maxPoints: number
  description: string
  icon: string
  evaluate: (coord: CoordinateData, allCoords: CoordinateData[]) => { points: number; alert?: string }
}

export type ExportFormat = 'csv' | 'xlsx' | 'geojson' | 'kml'

export type WizardStep = 1 | 2 | 3
