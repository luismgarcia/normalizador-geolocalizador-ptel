import { File, CheckCircle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ProcessedFile } from '@/lib/types'
import { getScoreColor, getScoreGradient } from '@/lib/validation'

interface FileComparisonProps {
  file: ProcessedFile
}

export function FileComparison({ file }: FileComparisonProps) {
  const confidenceLabel =
    file.averageScore >= 80
      ? 'ALTA CONFIANZA'
      : file.averageScore >= 60
      ? 'MEDIA CONFIANZA'
      : file.averageScore >= 40
      ? 'BAJA CONFIANZA'
      : 'RECHAZAR'

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <File size={24} weight="duotone" className="text-blue-600" />
              Archivo Original
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Nombre</p>
                <p className="text-sm font-medium">{file.originalName}</p>
              </div>

              <div className="flex gap-2">
                <Badge variant="secondary">{file.type || 'unknown'}</Badge>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Filas totales</p>
                <p className="text-sm font-medium">{file.rowCount}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Sistema detectado</p>
                <Badge className="bg-blue-600 text-white">{file.detectedSystem}</Badge>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Columnas detectadas</p>
                <p className="text-sm font-medium">
                  X: {file.xColumn} · Y: {file.yColumn}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Límites de coordenadas originales</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Min X:</span>{' '}
                    <span className="font-mono">{file.originalBounds.minX.toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max X:</span>{' '}
                    <span className="font-mono">{file.originalBounds.maxX.toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Min Y:</span>{' '}
                    <span className="font-mono">{file.originalBounds.minY.toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max Y:</span>{' '}
                    <span className="font-mono">{file.originalBounds.maxY.toFixed(6)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <CheckCircle size={24} weight="fill" className="text-green-600" />
              Archivo Validado UTM30
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Nombre de salida</p>
                <p className="text-sm font-medium">{file.name.replace(/\.[^/.]+$/, '')}_validado</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Sistema</p>
                <Badge className="bg-green-600 text-white">UTM30N (EPSG:25830)</Badge>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Score promedio</p>
                <p className={`text-lg font-bold ${getScoreColor(file.averageScore)}`}>
                  {file.averageScore}/100
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Alta confianza (80-100):</span>
                  <span className="font-semibold text-success">{file.highConfidence}</span>
                </div>
                <div className="flex justify-between">
                  <span>Media confianza (60-79):</span>
                  <span className="font-semibold text-warning-foreground">{file.mediumConfidence}</span>
                </div>
                <div className="flex justify-between">
                  <span>Baja confianza (40-59):</span>
                  <span className="font-semibold text-orange-600">{file.lowConfidence}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rechazadas (&lt;40):</span>
                  <span className="font-semibold text-destructive">{file.rejected}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Límites UTM30 en metros</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Min X:</span>{' '}
                    <span className="font-mono">{file.utm30Bounds.minX.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max X:</span>{' '}
                    <span className="font-mono">{file.utm30Bounds.maxX.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Min Y:</span>{' '}
                    <span className="font-mono">{file.utm30Bounds.minY.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max Y:</span>{' '}
                    <span className="font-mono">{file.utm30Bounds.maxY.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium">Score Promedio de Calidad</p>
            <p className={`text-2xl font-bold tabular-nums ${getScoreColor(file.averageScore)}`}>
              {file.averageScore}/100
            </p>
          </div>
          <Progress 
            value={file.averageScore} 
            className={`h-3 bg-gradient-to-r ${getScoreGradient(file.averageScore)}`}
          />
          <p className={`text-center text-lg font-bold tracking-wide ${getScoreColor(file.averageScore)}`}>
            {confidenceLabel}
          </p>
        </div>
      </Card>
    </div>
  )
}
