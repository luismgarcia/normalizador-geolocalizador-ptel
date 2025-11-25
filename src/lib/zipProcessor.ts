import JSZip from 'jszip'
import { processDBF } from './dbfProcessor'

export async function processZIP(file: File): Promise<any[]> {
  const zip = new JSZip()
  const zipContent = await zip.loadAsync(await file.arrayBuffer())
  
  const dbfFiles = Object.keys(zipContent.files).filter(name => 
    name.toLowerCase().endsWith('.dbf') && !zipContent.files[name].dir
  )
  
  if (dbfFiles.length === 0) {
    throw new Error('No se encontró archivo .dbf en el ZIP')
  }
  
  const dbfFileName = dbfFiles[0]
  const dbfData = await zipContent.files[dbfFileName].async('arraybuffer')
  const dbfFile = new File([dbfData], dbfFileName, { type: 'application/x-dbf' })
  
  return processDBF(dbfFile)
}
