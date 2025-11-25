import * as XLSX from 'xlsx'
import { ProcessedFile, CoordinateData } from './types'
import { 
  normalizeValue, 
  detectCoordinateSystem, 
  convertToUTM30, 
  detectCoordinateColumns 
} from './coordinateUtils'
import { calculateScore, classifyConfidence } from './validation'
import { processODT } from './odtProcessor'
import { processWordDocument } from './docxProcessor'
import { processDBF, detectCoordinateColumnsFromRecord } from './dbfProcessor'
import { processZIP } from './zipProcessor'
import { autoFixTruncatedY, detectTruncationPattern } from './coordinateFixers'
import { normalizeUTF8, hasCorruptedUTF8 } from './textNormalizers'
import { validateGeographicCoherence, generateGeographicReport } from './geographicValidators'
import { 
  normalizeCoordinate, 
  type NormalizationResult,
  type ConfidenceLevel 
} from './coordinateNormalizer'

export async function processFile(file: File): Promise<ProcessedFile> {
  let headers: string[]
  let dataWithHeaders: any[]
  let isDocumentFile = false
  let isDBFFile = false
  
  if (file.name.endsWith('.zip')) {
    const dbfRecords = await processZIP(file)
    headers = dbfRecords.length > 0 ? Object.keys(dbfRecords[0]) : []
    dataWithHeaders = dbfRecords
    isDBFFile = true
  } else if (file.name.endsWith('.dbf')) {
    const dbfRecords = await processDBF(file)
    headers = dbfRecords.length > 0 ? Object.keys(dbfRecords[0]) : []
    dataWithHeaders = dbfRecords
    isDBFFile = true
  } else if (file.name.endsWith('.odt')) {
    const odtResult = await processODT(file)
    headers = ['nombre', 'originalX', 'originalY', 'detectedSystem']
    dataWithHeaders = odtResult.rawData
    isDocumentFile = true
  } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
    const wordResult = await processWordDocument(file)
    headers = ['nombre', 'originalX', 'originalY', 'detectedSystem']
    dataWithHeaders = wordResult.rawData
    isDocumentFile = true
  } else {
    const arrayBuffer = await file.arrayBuffer()
    
    let workbook: XLSX.WorkBook
    
    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      const text = new TextDecoder('utf-8').decode(arrayBuffer)
      workbook = XLSX.read(text, { type: 'string' })
    } else {
      workbook = XLSX.read(arrayBuffer, { type: 'array' })
    }
    
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawData: any[] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: null })
    
    let headerRowIndex = 0
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i]
      if (row && row.some((cell: any) => cell && typeof cell === 'string')) {
        headerRowIndex = i
        break
      }
    }
    
    headers = rawData[headerRowIndex] as string[]
    const dataRows = rawData.slice(headerRowIndex + 1).filter(row => 
      row && row.some((cell: any) => cell !== null && cell !== undefined && cell !== '')
    )
    
    dataWithHeaders = dataRows.map(row => {
      const obj: any = {}
      headers.forEach((header, i) => {
        obj[header] = row[i]
      })
      return obj
    })
  }

  dataWithHeaders = dataWithHeaders.map(row => {
    const normalized: any = {}
    for (const key in row) {
      if (typeof row[key] === 'string') {
        normalized[key] = normalizeUTF8(row[key])
      } else {
        normalized[key] = row[key]
      }
    }
    return normalized
  })
  
  let xCol: string
  let yCol: string
  
  if (isDocumentFile) {
    xCol = 'originalX'
    yCol = 'originalY'
  } else if (isDBFFile && dataWithHeaders.length > 0) {
    const firstRecord = dataWithHeaders[0]
    const detectedFromRecord = detectCoordinateColumnsFromRecord(firstRecord)
    
    if (!detectedFromRecord || !detectedFromRecord.xField || !detectedFromRecord.yField) {
      throw new Error('No se pudieron detectar columnas de coordenadas en el archivo DBF. Verifica que contiene campos X/Y o Lon/Lat.')
    }
    
    const originalXField = Object.keys(firstRecord).find(k => k.toLowerCase() === detectedFromRecord.xField?.toLowerCase())
    const originalYField = Object.keys(firstRecord).find(k => k.toLowerCase() === detectedFromRecord.yField?.toLowerCase())
    
    xCol = originalXField || detectedFromRecord.xField
    yCol = originalYField || detectedFromRecord.yField
    
    console.log(`DBF: Usando campos ${xCol} y ${yCol} para coordenadas`)
  } else {
    const detectedCols = detectCoordinateColumns(headers)
    
    if (!detectedCols.xCol || !detectedCols.yCol) {
      throw new Error('No se pudieron detectar columnas de coordenadas. Verifica que el archivo contiene columnas X/Y o Lon/Lat.')
    }
    
    xCol = detectedCols.xCol
    yCol = detectedCols.yCol
  }
  
  const xValues = dataWithHeaders
    .map(row => normalizeValue(row[xCol]))
    .filter(v => v !== null) as number[]
  const yValues = dataWithHeaders
    .map(row => normalizeValue(row[yCol]))
    .filter(v => v !== null) as number[]
  
  if (xValues.length === 0 || yValues.length === 0) {
    throw new Error('No se encontraron valores numéricos válidos en las columnas de coordenadas.')
  }
  
  const detectionResult = detectCoordinateSystem(xValues, yValues)

  const truncationInfo = detectTruncationPattern(
    xValues.map((x, i) => ({ x, y: yValues[i] }))
  )

  const coordinates: CoordinateData[] = []

  for (let i = 0; i < dataWithHeaders.length; i++) {
    const originalData = dataWithHeaders[i]
    
    const originalX = originalData[xCol]
    const originalY = originalData[yCol]
    
    const provincia = originalData['provincia'] || originalData['Provincia']
    const municipio = originalData['municipio'] || originalData['Municipio']

    const normResult = normalizeCoordinate({
      x: originalX,
      y: originalY,
      municipality: municipio,
      province: provincia
    })

    if (!normResult.isValid || normResult.x === null || normResult.y === null) {
      continue
    }

    const normalizedX = normResult.x
    const normalizedY = normResult.y
    
    const converted = convertToUTM30(normalizedX, normalizedY, detectionResult.epsg)
    
    if (!converted) {
      continue
    }

    const nombre = originalData['nombre'] || originalData['Nombre'] || originalData['NOMBRE'] || ''
    const hadCorruption = typeof originalX === 'string' && hasCorruptedUTF8(originalX) ||
                          typeof originalY === 'string' && hasCorruptedUTF8(originalY) ||
                          typeof nombre === 'string' && hasCorruptedUTF8(nombre)
    
    const fixResult = autoFixTruncatedY(normalizedX, normalizedY, provincia)

    const coord: CoordinateData = {
      index: i,
      originalX,
      originalY,
      normalizedX,
      normalizedY,
      utm30_x: converted.utm30_x,
      utm30_y: converted.utm30_y,
      wgs84_lon: converted.wgs84_lon,
      wgs84_lat: converted.wgs84_lat,
      score: normResult.score,
      confidence: normResult.confidence,
      alerts: [],
      detectedSystem: detectionResult.system,
      detectedSystemConfidence: detectionResult.confidence,
      autoFixed: fixResult.fixed,
      fixConfidence: fixResult.confidence,
      fixReason: fixResult.reason,
      hadUTF8Corruption: hadCorruption,
      corrections: normResult.corrections,
      ...originalData
    }
    
    coordinates.push(coord)
  }

  const coordsForGeoValidation = coordinates.map(c => ({
    x: c.utm30_x,
    y: c.utm30_y,
    nombre: c.nombre || c.Nombre || c.NOMBRE || `Elemento ${c.index + 1}`
  }))

  const geoValidation = validateGeographicCoherence(coordsForGeoValidation, { maxDistance: 20000 })
  const geoReport = generateGeographicReport(geoValidation)
  
  for (let i = 0; i < coordinates.length; i++) {
    const coord = coordinates[i]
    const geoResult = geoValidation[i]

    const { score, alerts } = calculateScore(coord, coordinates)

    const allAlerts = [...alerts]

    if (coord.autoFixed) {
      allAlerts.unshift(`✅ Y truncada corregida: ${coord.originalY} → ${coord.normalizedY}`)
    }

    if (coord.hadUTF8Corruption) {
      allAlerts.push('ℹ️ Caracteres UTF-8 normalizados')
    }

    allAlerts.push(...geoResult.alerts)

    const finalScore = Math.min(score, geoResult.score)

    coord.score = finalScore
    coord.alerts = allAlerts
    coord.confidence = classifyConfidence(finalScore)
    coord.geographicValidation = {
      nearestDistance: geoResult.nearestNeighborDistance,
      isOutlier: geoResult.isGeographicOutlier
    }
  }
  
  const originalBounds = {
    minX: Math.min(...coordinates.map(c => c.normalizedX)),
    maxX: Math.max(...coordinates.map(c => c.normalizedX)),
    minY: Math.min(...coordinates.map(c => c.normalizedY)),
    maxY: Math.max(...coordinates.map(c => c.normalizedY))
  }
  
  const utm30Bounds = {
    minX: Math.min(...coordinates.map(c => c.utm30_x)),
    maxX: Math.max(...coordinates.map(c => c.utm30_x)),
    minY: Math.min(...coordinates.map(c => c.utm30_y)),
    maxY: Math.max(...coordinates.map(c => c.utm30_y))
  }
  
  const averageScore = coordinates.reduce((sum, c) => sum + c.score, 0) / coordinates.length
  
  const highConfidence = coordinates.filter(c => c.confidence === 'ALTA' || c.confidence === 'HIGH').length
  const mediumConfidence = coordinates.filter(c => c.confidence === 'MEDIA' || c.confidence === 'MEDIUM').length
  const lowConfidence = coordinates.filter(c => c.confidence === 'BAJA' || c.confidence === 'LOW').length
  const rejected = coordinates.filter(c => c.confidence === 'NULA' || c.confidence === 'CRITICAL').length
  
  const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  return {
    id: fileId,
    name: file.name,
    originalName: file.name,
    type: file.type || 'unknown',
    detectedSystem: detectionResult.system,
    rowCount: coordinates.length,
    xColumn: xCol,
    yColumn: yCol,
    originalBounds,
    utm30Bounds,
    averageScore: Math.round(averageScore),
    coordinates,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    rejected,
    originalColumns: headers,
    rawData: dataWithHeaders
  }
}
