import JSZip from 'jszip'
import { CoordinateData } from './types'
import { normalizeCoordinate } from './coordinateUtils'

const ODF_TABLE_NS = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0'
const ODF_TEXT_NS = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'

interface TableData {
  rows: string[][]
}

interface ExtractedCoordinate {
  nombre?: string
  direccion?: string
  originalX: string | number
  originalY: string | number
  detectedSystem?: string
  [key: string]: any
}

export async function processODT(file: File): Promise<{ rawData: any[], headers: string[] }> {
  const zip = await JSZip.loadAsync(file)
  
  const contentFile = zip.file('content.xml')
  if (!contentFile) {
    throw new Error('El archivo .odt no contiene content.xml')
  }
  
  const contentXML = await contentFile.async('text')
  
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(contentXML, 'text/xml')
  
  const parserError = xmlDoc.querySelector('parsererror')
  if (parserError) {
    throw new Error('Error al parsear el XML del archivo .odt')
  }
  
  const tables = xmlDoc.getElementsByTagNameNS(ODF_TABLE_NS, 'table')
  
  if (tables.length === 0) {
    throw new Error('No se encontraron tablas en el archivo .odt')
  }
  
  let allCoordinates: ExtractedCoordinate[] = []
  let foundHeaders: string[] = []
  let tablesProcessed = 0
  let tablesWithCoordinates = 0
  let diagnosticInfo: string[] = []
  
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]
    const tableData = extractTableData(table)
    
    if (tableData.rows.length === 0) {
      continue
    }
    
    tablesProcessed++
    
    const firstRow = tableData.rows[0]?.slice(0, 10).join(', ') || ''
    const firstRowPreview = firstRow.substring(0, 100)
    diagnosticInfo.push(`Tabla ${i + 1}: ${tableData.rows.length} filas. Primera fila: "${firstRowPreview}${firstRow.length > 100 ? '...' : ''}"`)
    
    if (hasCoordinates(tableData)) {
      tablesWithCoordinates++
      diagnosticInfo.push(`  → Detectada como tabla de coordenadas`)
      
      const result = extractCoordinatesFromTableData(tableData)
      
      if (result.coordinates.length > 0) {
        diagnosticInfo.push(`  ✓ Extraídas: ${result.coordinates.length} coordenadas`)
        allCoordinates = allCoordinates.concat(result.coordinates)
        if (foundHeaders.length === 0) {
          foundHeaders = result.headers
        }
      } else {
        diagnosticInfo.push(`  ⚠ Sin coordenadas válidas extraídas`)
      }
    }
  }
  
  if (allCoordinates.length === 0) {
    const diagnostic = diagnosticInfo.join('\n')
    if (tablesProcessed === 0) {
      throw new Error('No se encontraron tablas en el archivo .odt')
    } else if (tablesWithCoordinates === 0) {
      throw new Error(
        `No se encontraron tablas con columnas de coordenadas en el archivo .odt.\n\n` +
        `El archivo debe contener al menos una tabla con columnas como:\n` +
        `• "Coordenadas", "UTM", "X", "Y", "Longitud", "Latitud", etc.\n\n` +
        `Tablas analizadas: ${tablesProcessed}\n\n` +
        `💡 Consejo: Verifica que las tablas tienen encabezados con palabras clave de coordenadas.`
      )
    } else {
      throw new Error(
        `Se encontraron ${tablesWithCoordinates} tabla(s) con columnas de coordenadas, pero ninguna contenía datos válidos.\n\n` +
        `Causas comunes:\n` +
        `• Las celdas de coordenadas están vacías\n` +
        `• Las celdas contienen texto de marcador ("INDICAR", "No especificado", etc.)\n` +
        `• Los valores no son números válidos\n\n` +
        `💡 Solución: Asegúrate de que las celdas de coordenadas contengan valores numéricos reales.\n\n` +
        `Diagnóstico detallado:\n${diagnostic}`
      )
    }
  }
  
  return {
    rawData: allCoordinates,
    headers: foundHeaders
  }
}

function extractTableData(tableElement: Element): TableData {
  const rows: string[][] = []
  
  const tableRows = tableElement.getElementsByTagNameNS(ODF_TABLE_NS, 'table-row')
  
  for (let i = 0; i < tableRows.length; i++) {
    const row = tableRows[i]
    const cells: string[] = []
    
    const tableCells = row.getElementsByTagNameNS(ODF_TABLE_NS, 'table-cell')
    
    for (let j = 0; j < tableCells.length; j++) {
      const cell = tableCells[j]
      
      const repeatAttr = cell.getAttributeNS(ODF_TABLE_NS, 'number-columns-repeated')
      const repeatCount = repeatAttr ? parseInt(repeatAttr, 10) : 1
      
      const paragraphs = cell.getElementsByTagNameNS(ODF_TEXT_NS, 'p')
      let cellText = ''
      
      for (let k = 0; k < paragraphs.length; k++) {
        const pText = paragraphs[k].textContent || ''
        cellText += (cellText ? ' ' : '') + pText
      }
      
      cellText = cellText.trim()
      
      for (let r = 0; r < repeatCount; r++) {
        cells.push(cellText)
      }
    }
    
    rows.push(cells)
  }
  
  return { rows }
}

function hasCoordinates(tableData: TableData): boolean {
  if (tableData.rows.length < 2) {
    return false
  }
  
  const keywords = [
    'coordenadas',
    'utm',
    'geográficas',
    'geograficas',
    'longitud',
    'latitud',
    'x -',
    'y -',
    'coord',
    'lon',
    'lat',
    'este',
    'norte',
    /\bx\b/i,
    /\by\b/i
  ]
  
  const searchRows = tableData.rows.slice(0, 3)
  
  for (const row of searchRows) {
    for (const cell of row) {
      if (!cell) continue
      const cellLower = cell.toLowerCase()
      for (const keyword of keywords) {
        if (typeof keyword === 'string') {
          if (cellLower.includes(keyword)) {
            return true
          }
        } else {
          if (keyword.test(cell)) {
            return true
          }
        }
      }
    }
  }
  
  return false
}

function extractCoordinatesFromTableData(tableData: TableData): { 
  coordinates: ExtractedCoordinate[], 
  headers: string[] 
} {
  if (tableData.rows.length < 2) {
    return { coordinates: [], headers: [] }
  }
  
  console.log('DEBUG - Total filas en tabla:', tableData.rows.length)
  console.log('DEBUG - Primeras 4 filas completas:', tableData.rows.slice(0, 4))
  
  const coordinates: ExtractedCoordinate[] = []
  
  const headerRow = tableData.rows[1]
  let xColIndex = -1
  let yColIndex = -1
  
  for (let i = 0; i < headerRow.length; i++) {
    const header = headerRow[i].trim().toUpperCase()
    if (header === 'X' || header === 'X -' || header.includes('LONGITUD')) {
      xColIndex = i
    }
    if (header === 'Y' || header === 'Y -' || header.includes('LATITUD')) {
      yColIndex = i
    }
  }
  
  if (xColIndex !== -1 && yColIndex !== -1) {
    console.log(`✓ Encontradas columnas X=${xColIndex} Y=${yColIndex} en Fila 2`)
    
    for (let rowIdx = 2; rowIdx < tableData.rows.length; rowIdx++) {
      const row = tableData.rows[rowIdx]
      
      if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
        continue
      }
      
      const xValue = normalizeCoordinate(row[xColIndex])
      const yValue = normalizeCoordinate(row[yColIndex])
      
      console.log(`Fila ${rowIdx + 1}: X raw="${row[xColIndex]}" → normalized="${xValue}", Y raw="${row[yColIndex]}" → normalized="${yValue}"`)
      
      if (isValidCoordinate(xValue) && isValidCoordinate(yValue)) {
        const xNum = parseFloat(xValue)
        const yNum = parseFloat(yValue)
        const detectedSystem = detectCoordinateSystem(xNum, yNum)
        
        coordinates.push({
          nombre: row[1] || `Punto ${coordinates.length + 1}`,
          tipo: row[0] || '',
          direccion: row[3] || '',
          originalX: xValue,
          originalY: yValue,
          detectedSystem
        })
        
        console.log(`  ✓ Válida: (${xValue}, ${yValue}) - Sistema: ${detectedSystem}`)
      }
    }
  } else {
    console.log('⚠ No se encontraron columnas X/Y claras. Usando estrategia de búsqueda por rangos con SPLIT PRIMERO.')
    
    for (let rowIdx = 2; rowIdx < tableData.rows.length; rowIdx++) {
      const row = tableData.rows[rowIdx]
      
      if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
        continue
      }
      
      const xValues: string[] = []
      const yValues: string[] = []
      
      for (let cellIdx = 0; cellIdx < row.length; cellIdx++) {
        const cell = row[cellIdx]
        if (!cell) continue
        
        if (!isValidCoordinateValue(cell)) continue
        
        const parts = cell.split(/\s+/).filter(p => p.trim())
        
        console.log(`  Celda [${cellIdx}]: "${cell}" → ${parts.length} fragmentos:`, parts)
        
        for (const part of parts) {
          const normalized = normalizeCoordinate(part)
          if (!normalized) continue
          
          const num = parseFloat(normalized)
          if (isNaN(num) || num === 0) continue
          
          const isUTM_X = num >= 100000 && num <= 900000
          const isUTM_Y = num >= 3000000 && num <= 5000000
          const isGeo_Lon = Math.abs(num) <= 180 && Math.abs(num) > 0.1
          const isGeo_Lat = Math.abs(num) <= 90 && Math.abs(num) > 0.1
          
          if (num < 100) {
            console.log(`    Rechazado: ${num} (< 100, probablemente no es coordenada)`)
            continue
          }
          
          if (isUTM_X || isGeo_Lon) {
            console.log(`    → X: ${normalized} (de "${part}")`)
            xValues.push(normalized)
          } else if (isUTM_Y || isGeo_Lat) {
            console.log(`    → Y: ${normalized} (de "${part}")`)
            yValues.push(normalized)
          } else {
            console.log(`    Rechazado: ${num} (fuera de rangos válidos)`)
          }
        }
      }
      
      const pairs = Math.min(xValues.length, yValues.length)
      console.log(`  Total: ${xValues.length} X, ${yValues.length} Y → ${pairs} pares`)
      
      for (let i = 0; i < pairs; i++) {
        const x = xValues[i]
        const y = yValues[i]
        
        if (isValidCoordinate(x) && isValidCoordinate(y)) {
          const xNum = parseFloat(x)
          const yNum = parseFloat(y)
          const detectedSystem = detectCoordinateSystem(xNum, yNum)
          
          coordinates.push({
            nombre: `Punto ${coordinates.length + 1}`,
            originalX: x,
            originalY: y,
            detectedSystem
          })
          
          console.log(`  ✓ Fila ${rowIdx + 1} Par ${i + 1}: (${x}, ${y}) - Sistema: ${detectedSystem}`)
        }
      }
    }
  }
  
  console.log(`Total coordenadas extraídas: ${coordinates.length}`)
  
  return { coordinates, headers: tableData.rows[0] || [] }
}

function isValidCoordinate(value: string): boolean {
  if (!value) return false
  const num = parseFloat(value)
  if (isNaN(num) || !isFinite(num)) return false
  
  const isUTM_X = num >= 100000 && num <= 900000
  const isUTM_Y = num >= 3000000 && num <= 5000000
  const isGeo_Lon = Math.abs(num) <= 180 && Math.abs(num) > 0.001
  const isGeo_Lat = Math.abs(num) <= 90 && Math.abs(num) > 0.001
  
  return isUTM_X || isUTM_Y || isGeo_Lon || isGeo_Lat
}

function extractFromCombinedColumn(
  dataRows: string[][],
  allHeaders: string[],
  combinedColIndex: number
): { coordinates: ExtractedCoordinate[], headers: string[] } {
  const coordinates: ExtractedCoordinate[] = []
  let skippedRows = 0
  let emptyValues = 0
  let unparseable = 0
  
  for (const row of dataRows) {
    if (row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
      continue
    }
    
    const combinedValue = row[combinedColIndex] || ''
    
    if (!combinedValue.trim()) {
      emptyValues++
      skippedRows++
      continue
    }
    
    if (!isValidCoordinateValue(combinedValue)) {
      skippedRows++
      continue
    }
    
    const parsed = parseCombinedCoordinates(combinedValue)
    
    if (!parsed) {
      unparseable++
      skippedRows++
      continue
    }
    
    const coord: ExtractedCoordinate = {
      originalX: parsed.x,
      originalY: parsed.y
    }
    
    allHeaders.forEach((header, index) => {
      if (index < row.length && row[index]) {
        const cleanHeader = header.trim() || `Columna_${index + 1}`
        coord[cleanHeader] = row[index]
      }
    })
    
    coordinates.push(coord)
  }
  
  if (skippedRows > 0) {
    console.log(`Filas omitidas: ${skippedRows} (${emptyValues} vacías, ${unparseable} no parseables)`)
  }
  console.log(`Coordenadas extraídas de columna combinada: ${coordinates.length}`)
  
  return { coordinates, headers: allHeaders }
}

function parseCombinedCoordinates(value: string): { x: string, y: string } | null {
  const trimmed = value.trim()
  
  const patterns = [
    /^([0-9.,\-+]+)\s*[,;/|]\s*([0-9.,\-+]+)$/,
    /^([0-9.,\-+]+)\s+([0-9.,\-+]+)$/,
    /X[:\s]*([0-9.,\-+]+)[,;\s]+Y[:\s]*([0-9.,\-+]+)/i,
    /([0-9.,\-+]+)[,;\s]+([0-9.,\-+]+)/,
    /\(([0-9.,\-+]+)[,;]\s*([0-9.,\-+]+)\)/
  ]
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern)
    if (match) {
      const xStr = normalizeCoordinateString(match[1])
      const yStr = normalizeCoordinateString(match[2])
      
      const xNum = parseFloat(xStr)
      const yNum = parseFloat(yStr)
      
      if (!isNaN(xNum) && !isNaN(yNum)) {
        return { x: match[1], y: match[2] }
      }
    }
  }
  
  return null
}

function identifyCoordinateColumns(headers: string[]): {
  xColIndex: number
  yColIndex: number
  xColName: string
  yColName: string
  combinedColIndex: number
  combinedColName: string
  allHeaders: string[]
} {
  const xPatterns = [
    /^x$/i,
    /^lon/i,
    /longitud/i,
    /^x[\s\-_]/i,
    /este/i,
    /coord.*x/i,
    /utm.*x/i,
    /^x\s*\(/i,
    /\bx\b/i,
    /^x\s*[-–—]/i
  ]
  
  const yPatterns = [
    /^y$/i,
    /^lat/i,
    /latitud/i,
    /^y[\s\-_]/i,
    /norte/i,
    /coord.*y/i,
    /utm.*y/i,
    /^y\s*\(/i,
    /\by\b/i,
    /^y\s*[-–—]/i
  ]
  
  const combinedPatterns = [
    /coordenadas/i,
    /coord\s*\(/i,
    /utm/i,
    /geográfic/i,
    /geografic/i,
    /posición/i,
    /posicion/i
  ]
  
  let xColIndex = -1
  let yColIndex = -1
  let xColName = ''
  let yColName = ''
  let combinedColIndex = -1
  let combinedColName = ''
  
  const cleanHeaders: string[] = headers.map((h, i) => {
    const cleaned = h ? h.trim() : `Columna_${i + 1}`
    return cleaned || `Columna_${i + 1}`
  })
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i] || ''
    
    if (combinedColIndex === -1) {
      for (const pattern of combinedPatterns) {
        if (pattern.test(header)) {
          combinedColIndex = i
          combinedColName = cleanHeaders[i]
          break
        }
      }
    }
    
    if (xColIndex === -1) {
      for (const pattern of xPatterns) {
        if (pattern.test(header)) {
          xColIndex = i
          xColName = cleanHeaders[i]
          break
        }
      }
    }
    
    if (yColIndex === -1) {
      for (const pattern of yPatterns) {
        if (pattern.test(header)) {
          yColIndex = i
          yColName = cleanHeaders[i]
          break
        }
      }
    }
  }
  
  return {
    xColIndex,
    yColIndex,
    xColName,
    yColName,
    combinedColIndex,
    combinedColName,
    allHeaders: cleanHeaders
  }
}

function isValidCoordinateValue(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false
  }
  
  const trimmed = value.trim().toLowerCase()
  
  if (trimmed === '') {
    return false
  }
  
  const invalidPatterns = [
    'no especificada',
    'no especificado',
    'indicar',
    'n/a',
    'n.a.',
    'sin dato',
    'sin datos',
    'desconocido',
    'desconocida',
    'pendiente'
  ]
  
  for (const pattern of invalidPatterns) {
    if (trimmed.includes(pattern)) {
      return false
    }
  }
  
  return true
}

function normalizeCoordinateString(value: string): string {
  let normalized = value.trim()
  
  normalized = normalized.replace(/\s+/g, '')
  
  normalized = normalized.replace(/,/g, '.')
  
  normalized = normalized.replace(/[^\d.\-+eE]/g, '')
  
  normalized = normalized.replace(/\.{2,}/g, '.')
  
  const parts = normalized.split('.')
  if (parts.length > 2) {
    normalized = parts[0] + '.' + parts.slice(1).join('')
  }
  
  return normalized
}

function detectCoordinateSystem(x: number, y: number): string {
  const absX = Math.abs(x)
  const absY = Math.abs(y)
  
  if (absX <= 180 && absY <= 90) {
    if (x >= -10 && x <= -1 && y >= 36 && y <= 43) {
      return 'WGS84 (Andalucía)'
    }
    return 'WGS84'
  }
  
  if (x >= -10 && x <= 5 && y >= 35 && y <= 44) {
    return 'ETRS89 Geographic'
  }
  
  if (x >= 500000 && x <= 520000 && y >= 4075000 && y <= 4080000) {
    return 'UTM30N ETRS89 (Berja, Almería)'
  }
  
  if (x >= 160000 && x <= 770000 && y >= 3960000 && y <= 4280000) {
    return 'UTM30N ETRS89'
  }
  
  if (x >= 100000 && x <= 900000 && y >= 3900000 && y <= 4500000) {
    return 'UTM30N ED50'
  }
  
  if (absX > 100000 && absY > 1000000) {
    return 'UTM (zona desconocida)'
  }
  
  return 'Sistema no identificado'
}
