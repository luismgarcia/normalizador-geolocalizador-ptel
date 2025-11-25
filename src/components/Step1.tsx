import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import {
  UploadSimple,
  FileCsv,
  FileXls,
  File,
  Globe
} from '@phosphor-icons/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { processFile } from '@/lib/fileProcessor'
import { ProcessedFile } from '@/lib/types'

interface Step1Props {
  onFilesProcessed: (files: ProcessedFile[]) => void
}

export function Step1({ onFilesProcessed }: Step1Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFiles = useCallback(
    async (files: FileList) => {
      setIsProcessing(true)
      const processedFiles: ProcessedFile[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          toast.info(`Procesando ${file.name}...`)
          const processed = await processFile(file)
          processedFiles.push(processed)
          toast.success(`${file.name} procesado correctamente`)
        } catch (error) {
          toast.error(`Error al procesar ${file.name}: ${error instanceof Error ? error.message : 'Error desconocido'}`)
        }
      }

      setIsProcessing(false)

      if (processedFiles.length > 0) {
        onFilesProcessed(processedFiles)
      }
    },
    [onFilesProcessed]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files)
      }
    },
    [handleFiles]
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <UploadSimple size={28} weight="bold" />
            Paso 1: Subir archivos PTEL
          </CardTitle>
          <CardDescription className="text-base">
            Arrastra archivos con coordenadas de infraestructuras críticas municipales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              relative border-2 border-dashed rounded-lg p-12 text-center
              transition-all duration-300
              ${
                isDragging
                  ? 'border-primary bg-primary/10 scale-[1.02]'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }
              ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            <div className="flex justify-center gap-4 mb-6">
              <FileCsv size={40} weight="duotone" className="text-primary" />
              <FileXls size={40} weight="duotone" className="text-success" />
              <File size={40} weight="duotone" className="text-accent" />
            </div>

            <p className="text-xl font-semibold mb-2">
              {isDragging ? '¡Suelta los archivos aquí!' : 'Arrastra archivos aquí'}
            </p>
            <p className="text-muted-foreground mb-6">
              Soporta múltiples archivos simultáneos
            </p>

            <input
              type="file"
              id="file-input"
              multiple
              accept=".csv,.xlsx,.xls,.ods,.odt,.dbf,.zip"
              onChange={handleFileInput}
              className="hidden"
              disabled={isProcessing}
            />
            <Button
              size="lg"
              onClick={() => document.getElementById('file-input')?.click()}
              disabled={isProcessing}
            >
              <UploadSimple size={20} weight="bold" className="mr-2" />
              {isProcessing ? 'Procesando...' : 'Seleccionar archivos'}
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileCsv size={20} weight="duotone" />
                Formatos compatibles
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">CSV</Badge>
                <Badge variant="secondary">XLSX</Badge>
                <Badge variant="secondary">XLS</Badge>
                <Badge variant="secondary">ODS</Badge>
                <Badge variant="secondary">ODT</Badge>
                <Badge variant="secondary">DBF</Badge>
                <Badge variant="secondary">ZIP</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Formatos soportados: CSV, Excel (.xlsx, .xls), OpenDocument (.ods, .odt), DBF (Shapefile), ZIP (Shapefile)
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Globe size={20} weight="duotone" />
                Sistemas detectados
              </div>
              <p className="text-sm text-muted-foreground">
                20+ sistemas detectados automáticamente
              </p>
              <p className="text-xs text-muted-foreground">
                WGS84, ETRS89, ED50, UTM zones, Lambert 93, Web Mercator, etc.
              </p>
            </div>
          </div>

          <Alert className="bg-primary/10 border-primary/30">
            <AlertDescription>
              <p className="text-sm mb-3">
                Sistema de validación multivariable: aplica 8 estrategias de validación automática para detectar y corregir errores de formato, caracteres especiales, decimales incorrectos, transposiciones y coordenadas fuera de rango. Incluye validación espacial por proximidad de vecinos (20km) y sistema de puntuación de calidad en la conversión (0-100 puntos).
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                <strong>Archivos Word/ODT:</strong> Solo se procesan tablas. Asegúrate de que las tablas tienen columnas con nombres como "X", "Y", "Longitud", "Latitud", "UTM X", "UTM Y", "Este", "Norte", etc.
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Archivos DBF/Shapefile:</strong> Soporta archivos .dbf individuales o archivos .zip con shapefiles completos. Detecta automáticamente campos de coordenadas en formato DBF.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </motion.div>
  )
}
