import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { ProcessedFile, ExportFormat } from './types'

export function exportToCSV(processedFile: ProcessedFile): Blob {
  const headers = [
    ...processedFile.originalColumns,
    'X_UTM30',
    'Y_UTM30',
    'Lon_WGS84',
    'Lat_WGS84',
    'Score',
    'Confianza',
    'Alertas'
  ]
  
  const rows = processedFile.coordinates.map(coord => {
    const originalValues = processedFile.originalColumns.map(col => coord[col] ?? '')
    
    return [
      ...originalValues,
      coord.utm30_x.toFixed(2),
      coord.utm30_y.toFixed(2),
      coord.wgs84_lon.toFixed(6),
      coord.wgs84_lat.toFixed(6),
      coord.score,
      coord.confidence,
      coord.alerts.join(' | ')
    ]
  })
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      const str = String(cell)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(','))
  ].join('\n')
  
  return new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
}

export function exportToExcel(processedFile: ProcessedFile): Blob {
  const headers = [
    ...processedFile.originalColumns,
    'X_UTM30',
    'Y_UTM30',
    'Lon_WGS84',
    'Lat_WGS84',
    'Score',
    'Confianza',
    'Alertas'
  ]
  
  const rows = processedFile.coordinates.map(coord => {
    const originalValues = processedFile.originalColumns.map(col => coord[col] ?? '')
    
    return [
      ...originalValues,
      parseFloat(coord.utm30_x.toFixed(2)),
      parseFloat(coord.utm30_y.toFixed(2)),
      parseFloat(coord.wgs84_lon.toFixed(6)),
      parseFloat(coord.wgs84_lat.toFixed(6)),
      coord.score,
      coord.confidence,
      coord.alerts.join(' | ')
    ]
  })
  
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Coordenadas Validadas')
  
  const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function exportToGeoJSON(processedFile: ProcessedFile): Blob {
  const features = processedFile.coordinates.map(coord => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [coord.utm30_x, coord.utm30_y]
    },
    properties: {
      ...processedFile.originalColumns.reduce((acc, col) => {
        acc[col] = coord[col]
        return acc
      }, {} as any),
      X_UTM30: coord.utm30_x,
      Y_UTM30: coord.utm30_y,
      Lon_WGS84: coord.wgs84_lon,
      Lat_WGS84: coord.wgs84_lat,
      Score: coord.score,
      Confianza: coord.confidence,
      Alertas: coord.alerts.join(' | ')
    }
  }))
  
  const geojson = {
    type: 'FeatureCollection',
    crs: {
      type: 'name',
      properties: {
        name: 'EPSG:25830'
      }
    },
    features
  }
  
  return new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' })
}

export function exportToKML(processedFile: ProcessedFile): Blob {
  const placemarks = processedFile.coordinates.map(coord => {
    const description = `
      <![CDATA[
        <b>Score:</b> ${coord.score}/100<br/>
        <b>Confianza:</b> ${coord.confidence}<br/>
        <b>UTM30 X:</b> ${coord.utm30_x.toFixed(2)}<br/>
        <b>UTM30 Y:</b> ${coord.utm30_y.toFixed(2)}<br/>
        ${coord.alerts.length > 0 ? `<b>Alertas:</b><br/>${coord.alerts.join('<br/>')}` : ''}
      ]]>
    `
    
    return `
    <Placemark>
      <name>Coordenada ${coord.index + 1}</name>
      <description>${description}</description>
      <Point>
        <coordinates>${coord.wgs84_lon},${coord.wgs84_lat},0</coordinates>
      </Point>
    </Placemark>`
  }).join('\n')
  
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${processedFile.name} - Validado</name>
    <description>Coordenadas validadas con sistema de 8 estrategias - Score promedio: ${processedFile.averageScore}/100</description>
    ${placemarks}
  </Document>
</kml>`
  
  return new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' })
}

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportMultipleFilesAsZip(
  processedFiles: ProcessedFile[],
  format: ExportFormat
): Promise<Blob> {
  const zip = new JSZip()
  
  for (const file of processedFiles) {
    let blob: Blob
    let extension: string
    
    switch (format) {
      case 'csv':
        blob = exportToCSV(file)
        extension = 'csv'
        break
      case 'xlsx':
        blob = exportToExcel(file)
        extension = 'xlsx'
        break
      case 'geojson':
        blob = exportToGeoJSON(file)
        extension = 'geojson'
        break
      case 'kml':
        blob = exportToKML(file)
        extension = 'kml'
        break
    }
    
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    const fileName = `${baseName}_validado.${extension}`
    
    zip.file(fileName, blob)
  }
  
  return await zip.generateAsync({ type: 'blob' })
}

export function getExportFilename(originalName: string, format: ExportFormat): string {
  const baseName = originalName.replace(/\.[^/.]+$/, '')
  return `${baseName}_validado.${format}`
}
