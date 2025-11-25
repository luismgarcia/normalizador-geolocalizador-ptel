import JSZip from 'jszip'

const WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

interface ExtractedCoordinate {
  nombre?: string
  direccion?: string
  originalX: string | number
  originalY: string | number
  detectedSystem?: string
  [key: string]: any
}

export async function processWordDocument(file: File): Promise<{ rawData: any[], headers: string[] }> {
  const zip = await JSZip.loadAsync(file)
  
  const documentFile = zip.file('word/document.xml')
  if (!documentFile) {
    throw new Error('El archivo Word no contiene document.xml')
  }
  
  const documentXML = await documentFile.async('text')
  
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(documentXML, 'text/xml')
  
  const parserError = xmlDoc.querySelector('parsererror')
  if (parserError) {
    throw new Error('Error al parsear el XML del archivo Word')
  }
  
  const tables = xmlDoc.getElementsByTagNameNS(WORD_NAMESPACE, 'tbl')
  
  if (tables.length === 0) {
    throw new Error('⚠️ No se encontraron tablas en el archivo Word.\n\n📋 Este conversor solo procesa tablas con coordenadas.\n\n✅ Asegúrate de que el documento contiene al menos una tabla con columnas de coordenadas (X, Y, Longitud, Latitud, etc.).')
  }
  
  let allCoordinates: ExtractedCoordinate[] = []
  let foundHeaders: string[] = []
  let tablesProcessed = 0
  let tablesWithCoordinates = 0
  
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]
    const tableData = extractTableFromWordXML(table)
    
    if (tableData.rows.length === 0) {
      continue
    }
    
    tablesProcessed++
    
    if (hasCoordinates(tableData.rows)) {
      tablesWithCoordinates++
      const result = extractCoordinatesFromTableData(tableData.rows)
      if (result.coordinates.length > 0) {
        allCoordinates = allCoordinates.concat(result.coordinates)
        if (foundHeaders.length === 0) {
          foundHeaders = result.headers
        }
      }
    }
  }
  
  if (allCoordinates.length === 0) {
    if (tablesProcessed === 0) {
      throw new Error('⚠️ No se encontraron tablas en el documento Word.\n\n📋 Verifica que el documento contiene tablas.')
    } else if (tablesWithCoordinates === 0) {
      throw new Error(`⚠️ Se encontraron ${tablesProcessed} tabla(s) pero ninguna contiene coordenadas.\n\n📋 Las tablas deben tener columnas con nombres como:\n• "X" o "Y"\n• "Longitud" o "Latitud"\n• "UTM X" o "UTM Y"\n• "Este" o "Norte"\n• "Coord X" o "Coord Y"\n\n✅ Verifica que la primera fila de la tabla contiene estos nombres de columnas.`)
    } else {
      throw new Error(`⚠️ Se encontraron ${tablesWithCoordinates} tabla(s) con coordenadas pero no se pudieron extraer valores válidos.\n\n📋 Verifica que:\n• Los valores son numéricos\n• No contienen texto como "No especificada" o "Indicar"\n• El formato de decimales usa punto o coma\n• Las celdas no están vacías`)
    }
  }
  
  return {
    rawData: allCoordinates,
    headers: foundHeaders
  }
}

function extractTableFromWordXML(tableElement: Element): { rows: string[][] } {
  const rows: string[][] = []
  
  const tableRows = tableElement.getElementsByTagNameNS(WORD_NAMESPACE, 'tr')
  
  for (let i = 0; i < tableRows.length; i++) {
    const row = tableRows[i]
    const cells: string[] = []
    
    const tableCells = row.getElementsByTagNameNS(WORD_NAMESPACE, 'tc')
    
    for (let j = 0; j < tableCells.length; j++) {
      const cell = tableCells[j]
      
      const textElements = cell.getElementsByTagNameNS(WORD_NAMESPACE, 't')
      let cellText = ''
      
      for (let k = 0; k < textElements.length; k++) {
        const text = textElements[k].textContent || ''
        cellText += text
      }
      
      cellText = cellText.trim()
      cells.push(cellText)
    }
    
    if (cells.length > 0) {
      rows.push(cells)
    }
  }
  
  return { rows }
}

function hasCoordinates(rows: string[][]): boolean {
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
    'x(',
    'y('
  ]
  
  const searchRows = rows.slice(0, 3)
  
  for (const row of searchRows) {
    for (const cell of row) {
      const cellLower = cell.toLowerCase()
      for (const keyword of keywords) {
        if (cellLower.includes(keyword)) {
          return true
        }
      }
    }
  }
  
  return false
}

function extractCoordinatesFromTableData(rows: string[][]): { 
  coordinates: ExtractedCoordinate[], 
  headers: string[] 
} {
  if (rows.length < 2) {
    return { coordinates: [], headers: [] }
  }
  
  let headerRowIndex = 0
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const row = rows[i]
    if (row.some(cell => cell && cell.trim().length > 0)) {
      headerRowIndex = i
      break
    }
  }
  
  const headers = rows[headerRowIndex]
  const dataRows = rows.slice(headerRowIndex + 1)
  
  const { xColIndex, yColIndex, allHeaders } = identifyCoordinateColumns(headers)
  
  if (xColIndex === -1 || yColIndex === -1) {
    return { coordinates: [], headers: allHeaders }
  }
  
  const coordinates: ExtractedCoordinate[] = []
  
  for (const row of dataRows) {
    if (row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
      continue
    }
    
    const xValue = row[xColIndex] || ''
    const yValue = row[yColIndex] || ''
    
    if (!isValidCoordinateValue(xValue) || !isValidCoordinateValue(yValue)) {
      continue
    }
    
    const normalizedX = normalizeCoordinateString(xValue)
    const normalizedY = normalizeCoordinateString(yValue)
    
    const xNum = parseFloat(normalizedX)
    const yNum = parseFloat(normalizedY)
    
    if (isNaN(xNum) || isNaN(yNum)) {
      continue
    }
    
    const coord: ExtractedCoordinate = {
      originalX: xValue,
      originalY: yValue
    }
    
    allHeaders.forEach((header, index) => {
      if (index < row.length && row[index]) {
        const cleanHeader = header.trim() || `Columna_${index + 1}`
        coord[cleanHeader] = row[index]
      }
    })
    
    coordinates.push(coord)
  }
  
  return { coordinates, headers: allHeaders }
}

function identifyCoordinateColumns(headers: string[]): {
  xColIndex: number
  yColIndex: number
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
    /^x\s*-/i
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
    /^y\s*-/i
  ]
  
  let xColIndex = -1
  let yColIndex = -1
  
  const cleanHeaders: string[] = headers.map((h, i) => {
    const cleaned = h ? h.trim() : `Columna_${i + 1}`
    return cleaned || `Columna_${i + 1}`
  })
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i] || ''
    
    if (xColIndex === -1) {
      for (const pattern of xPatterns) {
        if (pattern.test(header)) {
          xColIndex = i
          break
        }
      }
    }
    
    if (yColIndex === -1) {
      for (const pattern of yPatterns) {
        if (pattern.test(header)) {
          yColIndex = i
          break
        }
      }
    }
  }
  
  return {
    xColIndex,
    yColIndex,
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
    'pendiente',
    'por determinar',
    'a determinar'
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
