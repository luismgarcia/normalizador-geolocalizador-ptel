import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  DownloadSimple,
  File,
  CheckCircle,
  Package,
  UploadSimple,
  ArrowsClockwise
} from '@phosphor-icons/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ProcessedFile, ExportFormat } from '@/lib/types'
import {
  exportToCSV,
  exportToExcel,
  exportToGeoJSON,
  exportToKML,
  downloadFile,
  exportMultipleFilesAsZip,
  getExportFilename
} from '@/lib/exportUtils'

interface Step3Props {
  files: ProcessedFile[]
  selectedFileId: string
  onBack: () => void
  onReset: () => void
  onNewFiles: () => void
}

export function Step3({ files, selectedFileId, onBack, onReset, onNewFiles }: Step3Props) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv')

  const selectedFile = files.find(f => f.id === selectedFileId) || files[0]

  const handleDownload = async () => {
    try {
      let blob: Blob
      
      switch (exportFormat) {
        case 'csv':
          blob = exportToCSV(selectedFile)
          break
        case 'xlsx':
          blob = exportToExcel(selectedFile)
          break
        case 'geojson':
          blob = exportToGeoJSON(selectedFile)
          break
        case 'kml':
          blob = exportToKML(selectedFile)
          break
      }

      const filename = getExportFilename(selectedFile.name, exportFormat)
      downloadFile(blob, filename)
      
      toast.success(`Archivo descargado: ${filename}`)
    } catch (error) {
      toast.error('Error al generar el archivo de descarga')
      console.error(error)
    }
  }

  const handleDownloadAll = async () => {
    try {
      toast.info('Generando ZIP...')
      
      const zipBlob = await exportMultipleFilesAsZip(files, exportFormat)
      downloadFile(zipBlob, `coordenadas_ptel_validadas.zip`)
      
      toast.success(`ZIP descargado con ${files.length} archivos`)
    } catch (error) {
      toast.error('Error al generar el archivo ZIP')
      console.error(error)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl mb-2">
                <DownloadSimple size={28} weight="bold" />
                Paso 3: Descargar coordenadas validadas
              </CardTitle>
              <CardDescription className="text-base">
                Elige formato y descarga coordenadas con scoring de calidad incluido
              </CardDescription>
            </div>
            <Button variant="outline" onClick={onBack}>
              Volver al análisis
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Card className="bg-accent/10 border-accent/30">
            <div className="p-6 space-y-4">
              <p className="text-lg font-semibold">Selecciona el formato de salida</p>
              <p className="text-sm text-muted-foreground">
                {selectedFile.rowCount} coordenadas listas (Score promedio: {selectedFile.averageScore}/100)
              </p>
              
              <Select value={exportFormat} onValueChange={(v: ExportFormat) => setExportFormat(v)}>
                <SelectTrigger className="h-14 text-lg font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (con score y alertas)</SelectItem>
                  <SelectItem value="xlsx">Excel (XLSX) (con score y alertas)</SelectItem>
                  <SelectItem value="geojson">GeoJSON (con properties de score)</SelectItem>
                  <SelectItem value="kml">KML (con descriptions de score)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <File size={20} weight="duotone" />
                Archivo
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nombre original:</span>{' '}
                  <span className="font-medium">{selectedFile.originalName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sistema:</span>{' '}
                  <span className="font-medium">{selectedFile.detectedSystem} → UTM30N</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Score promedio:</span>{' '}
                  <span className="font-bold text-primary">{selectedFile.averageScore}/100</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle size={20} weight="duotone" className="text-success" />
                Resumen de calidad
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alta confianza:</span>
                  <span className="font-semibold text-success">{selectedFile.highConfidence}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Media confianza:</span>
                  <span className="font-semibold text-warning-foreground">{selectedFile.mediumConfidence}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Baja confianza:</span>
                  <span className="font-semibold text-orange-600">{selectedFile.lowConfidence}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rechazadas:</span>
                  <span className="font-semibold text-destructive">{selectedFile.rejected}</span>
                </div>
              </div>
            </div>
          </div>

          <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <AlertDescription className="space-y-3">
              <p className="font-semibold text-sm">Datos incluidos en la exportación</p>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} weight="fill" className="text-success" />
                  <span>Coordenadas originales</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} weight="fill" className="text-success" />
                  <span>Coordenadas UTM30 (X_UTM30, Y_UTM30)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} weight="fill" className="text-success" />
                  <span>Coordenadas WGS84 (Lon_WGS84, Lat_WGS84)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} weight="fill" className="text-success" />
                  <span>Score de calidad (0-100)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} weight="fill" className="text-success" />
                  <span>Clasificación de confianza</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} weight="fill" className="text-success" />
                  <span>Alertas de validación</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} weight="fill" className="text-success" />
                  <span>Compatible con QGIS (CRS EPSG:25830)</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Nota: Las columnas originales se mantienen sin modificar
              </p>
            </AlertDescription>
          </Alert>

          <div className="flex flex-col items-center gap-4 pt-4">
            <Button size="lg" onClick={handleDownload} className="px-10">
              <DownloadSimple size={20} weight="bold" className="mr-2" />
              Descargar archivo validado
            </Button>

            {files.length > 1 && (
              <Button size="lg" variant="outline" onClick={handleDownloadAll} className="px-10">
                <Package size={20} weight="duotone" className="mr-2" />
                Descargar todos en ZIP ({files.length} archivos)
              </Button>
            )}
          </div>

          <Separator />

          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="outline" onClick={onNewFiles}>
              <UploadSimple size={18} className="mr-2" />
              Convertir más archivos
            </Button>
            <Button variant="outline" onClick={onReset}>
              <ArrowsClockwise size={18} className="mr-2" />
              Comenzar de nuevo
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
