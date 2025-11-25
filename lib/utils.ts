import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getFileIcon(filename: string): 'csv' | 'excel' | 'word' | 'ods' | 'odt' | 'text' | 'dbf' | 'geojson' | 'kml' | 'zip' | 'unknown' {
  const ext = filename.toLowerCase().split('.').pop()
  
  switch (ext) {
    case 'csv':
      return 'csv'
    case 'xlsx':
    case 'xls':
    case 'xlsb':
    case 'xlsm':
      return 'excel'
    case 'doc':
    case 'docx':
      return 'word'
    case 'ods':
    case 'fods':
      return 'ods'
    case 'odt':
      return 'odt'
    case 'txt':
      return 'text'
    case 'dbf':
      return 'dbf'
    case 'geojson':
    case 'json':
      return 'geojson'
    case 'kml':
    case 'kmz':
      return 'kml'
    case 'zip':
      return 'zip'
    default:
      return 'unknown'
  }
}
