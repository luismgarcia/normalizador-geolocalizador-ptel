import { CheckCircle, XCircle, ChartBar, TrendUp } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProcessedFile } from '@/lib/types'
import { getBatchStats } from '@/lib/coordinateNormalizer'

interface NormalizationStatsProps {
  file: ProcessedFile
}

export function NormalizationStats({ file }: NormalizationStatsProps) {
  const normResults = file.coordinates.map(coord => ({
    x: coord.normalizedX,
    y: coord.normalizedY,
    score: coord.score,
    confidence: coord.confidence as 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL',
    corrections: coord.corrections || [],
    isValid: coord.score > 0,
    errors: coord.alerts || []
  }))

  const stats = getBatchStats(normResults)

  return (
    <Card className="mt-4 border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChartBar size={24} weight="duotone" className="text-primary" />
          Resumen de Normalización v2.0
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendUp size={20} weight="duotone" className="text-muted-foreground" />
            <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
          </div>
          <div className="text-sm text-muted-foreground">Total procesadas</div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} weight="duotone" className="text-success" />
            <div className="text-2xl font-bold text-success tabular-nums">{stats.valid}</div>
          </div>
          <div className="text-sm text-muted-foreground">Válidas</div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <XCircle size={20} weight="duotone" className="text-destructive" />
            <div className="text-2xl font-bold text-destructive tabular-nums">{stats.invalid}</div>
          </div>
          <div className="text-sm text-muted-foreground">Inválidas</div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ChartBar size={20} weight="duotone" className="text-primary" />
            <div className="text-2xl font-bold text-primary tabular-nums">{stats.avgScore.toFixed(0)}</div>
          </div>
          <div className="text-sm text-muted-foreground">Score promedio</div>
        </div>
      </CardContent>

      <CardContent className="pt-0">
        <div className="text-sm font-semibold mb-3">Distribución por nivel de confianza:</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="text-lg font-bold text-green-600 tabular-nums">{stats.highConfidence}</div>
            <div className="text-xs text-muted-foreground">HIGH (76-100)</div>
          </div>

          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="text-lg font-bold text-yellow-600 tabular-nums">{stats.mediumConfidence}</div>
            <div className="text-xs text-muted-foreground">MEDIUM (51-75)</div>
          </div>

          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
            <div className="text-lg font-bold text-orange-600 tabular-nums">{stats.lowConfidence}</div>
            <div className="text-xs text-muted-foreground">LOW (26-50)</div>
          </div>

          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <div className="text-lg font-bold text-red-600 tabular-nums">{stats.criticalConfidence}</div>
            <div className="text-xs text-muted-foreground">CRITICAL (0-25)</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
