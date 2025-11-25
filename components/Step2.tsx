import { motion } from 'framer-motion'
import { useState } from 'react'
import {
  MagnifyingGlass,
  ArrowsClockwise,
  DownloadSimple,
  File,
  Trash,
  Stack,
  FileCsv,
  FileXls,
  FileText,
  FileDoc
} from '@phosphor-icons/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProcessedFile } from '@/lib/types'
import { FileComparison } from './step2/FileComparison'
import { ValidationStrategies } from './step2/ValidationStrategies'
import { DataTabs } from './step2/DataTabs'
import { NormalizationStats } from './step2/NormalizationStats'
import { getFileIcon } from '@/lib/utils'

interface Step2Props {
  files: ProcessedFile[]
  onContinue: () => void
  onReset: () => void
  onRemoveFile: (fileId: string) => void
}

function FileIcon({ filename, size = 24 }: { filename: string, size?: number }) {
  const iconType = getFileIcon(filename)
  const className = "flex-shrink-0 mt-1"
  
  switch (iconType) {
    case 'csv':
      return <FileCsv size={size} weight="duotone" className={`${className} text-primary`} />
    case 'excel':
      return <FileXls size={size} weight="duotone" className={`${className} text-success`} />
    case 'word':
      return <FileDoc size={size} weight="duotone" className={`${className} text-blue-500`} />
    case 'ods':
      return <File size={size} weight="duotone" className={`${className} text-accent`} />
    case 'odt':
      return <FileText size={size} weight="duotone" className={`${className} text-accent`} />
    case 'text':
      return <FileText size={size} weight="duotone" className={`${className} text-muted-foreground`} />
    default:
      return <File size={size} weight="duotone" className={`${className} text-muted-foreground`} />
  }
}

export function Step2({ files, onContinue, onReset, onRemoveFile }: Step2Props) {
  const [selectedFileId, setSelectedFileId] = useState<string>(files[0]?.id || '')

  const selectedFile = files.find(f => f.id === selectedFileId) || files[0]

  if (!selectedFile) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl mb-2">
                <MagnifyingGlass size={28} weight="bold" />
                Paso 2: Validación y análisis de calidad
              </CardTitle>
              <CardDescription className="text-base">
                Resultados del sistema defensivo de validación con scoring de calidad
              </CardDescription>
            </div>
            <Button variant="outline" onClick={onReset}>
              <ArrowsClockwise size={18} className="mr-2" />
              Nuevo
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {files.length > 1 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Stack size={20} weight="duotone" />
                Archivos procesados ({files.length})
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {files.map(file => (
                  <motion.button
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    className={`
                      relative p-4 rounded-lg border-2 text-left transition-all
                      ${
                        selectedFileId === file.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30 hover:bg-muted/50'
                      }
                    `}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-start gap-3">
                      <FileIcon filename={file.name} size={24} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate mb-1">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.detectedSystem} → UTM30
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {file.rowCount} coordenadas
                        </p>
                        <p className="text-xs font-medium mt-1">
                          Score: {file.averageScore}/100
                        </p>
                      </div>
                      {files.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2 h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveFile(file.id)
                          }}
                        >
                          <Trash size={16} />
                        </Button>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {(() => {
            const autoFixedCount = selectedFile.coordinates.filter(c => c.autoFixed).length
            const utf8CorrectedCount = selectedFile.coordinates.filter(c => c.hadUTF8Corruption).length
            const geoOutliers = selectedFile.coordinates.filter(c => c.geographicValidation?.isOutlier).length

            if (autoFixedCount > 0 || utf8CorrectedCount > 0 || geoOutliers > 0) {
              return (
                <div className="space-y-2">
                  {autoFixedCount > 0 && (
                    <div className="bg-success/10 border border-success/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">✅</span>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-success-foreground">
                            Coordenadas Y truncadas corregidas automáticamente
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Se detectaron y corrigieron {autoFixedCount} coordenada{autoFixedCount > 1 ? 's' : ''} 
                            Y truncada{autoFixedCount > 1 ? 's' : ''} (faltaba el dígito inicial "4")
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {utf8CorrectedCount > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">ℹ️</span>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">
                            Caracteres UTF-8 normalizados
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Se corrigieron caracteres corruptos (� → á, é, í, ó, ú, ñ) en {utf8CorrectedCount} registro{utf8CorrectedCount > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {geoOutliers > 0 && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">🚨</span>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-destructive">
                            Errores geográficos extremos detectados
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {geoOutliers} elemento{geoOutliers > 1 ? 's están' : ' está'} a más de 20km de sus vecinos más cercanos. 
                            Verifica manualmente estas coordenadas antes de usarlas.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            }
            return null
          })()}

          <FileComparison file={selectedFile} />

          <NormalizationStats file={selectedFile} />

          <ValidationStrategies file={selectedFile} />

          <DataTabs file={selectedFile} />

          <div className="flex justify-center pt-4">
            <Button size="lg" onClick={onContinue} className="px-10">
              <DownloadSimple size={20} weight="bold" className="mr-2" />
              Continuar a descarga
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
