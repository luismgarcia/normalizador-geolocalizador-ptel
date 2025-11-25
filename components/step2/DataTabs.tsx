import { useState } from 'react'
import { CheckCircle, Warning, XCircle } from '@phosphor-icons/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProcessedFile, CoordinateData } from '@/lib/types'
import { getConfidenceColor, getScoreColor } from '@/lib/validation'

interface DataTabsProps {
  file: ProcessedFile
}

export function DataTabs({ file }: DataTabsProps) {
  const [filter, setFilter] = useState<'all' | 'alta' | 'media' | 'baja'>('all')
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const filteredCoords = file.coordinates.filter(coord => {
    if (filter === 'all') return true
    if (filter === 'alta') return coord.confidence === 'ALTA' || coord.confidence === 'CRÍTICA' || coord.confidence === 'HIGH'
    if (filter === 'media') return coord.confidence === 'MEDIA' || coord.confidence === 'MEDIUM'
    if (filter === 'baja') return coord.confidence === 'BAJA' || coord.confidence === 'NULA' || coord.confidence === 'LOW' || coord.confidence === 'CRITICAL'
    return true
  })

  const displayCoords = filteredCoords.slice(0, 20)

  const toggleRow = (index: number) => {
    const newSet = new Set(expandedRows)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    setExpandedRows(newSet)
  }

  return (
    <Tabs defaultValue="summary" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="summary">Resumen de Calidad</TabsTrigger>
        <TabsTrigger value="original">Coordenadas Originales</TabsTrigger>
        <TabsTrigger value="validated">Coordenadas Validadas UTM30</TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-6 bg-purple-100/50 border-purple-300">
            <div className="flex items-start gap-3">
              <CheckCircle size={32} weight="duotone" className="text-purple-700 flex-shrink-0" />
              <div>
                <p className="text-3xl font-bold text-purple-900 tabular-nums">
                  {file.coordinates.filter(c => c.confidence === 'CRÍTICA').length}
                </p>
                <p className="text-sm font-medium mt-1">Crítica</p>
                <p className="text-xs text-muted-foreground">Score: 95-100 puntos</p>
                <Badge className="mt-2 bg-purple-700 text-white text-xs">
                  ⭐ Excelencia total
                </Badge>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-success/10 border-success/30">
            <div className="flex items-start gap-3">
              <CheckCircle size={32} weight="duotone" className="text-success flex-shrink-0" />
              <div>
                <p className="text-3xl font-bold text-success tabular-nums">{file.highConfidence}</p>
                <p className="text-sm font-medium mt-1">Alta Confianza</p>
                <p className="text-xs text-muted-foreground">Score: 80-94 puntos</p>
                <Badge className="mt-2 bg-success text-success-foreground text-xs">
                  ✅ Uso directo en QGIS
                </Badge>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-warning/10 border-warning/30">
            <div className="flex items-start gap-3">
              <Warning size={32} weight="duotone" className="text-warning-foreground flex-shrink-0" />
              <div>
                <p className="text-3xl font-bold text-warning-foreground tabular-nums">{file.mediumConfidence}</p>
                <p className="text-sm font-medium mt-1">Media Confianza</p>
                <p className="text-xs text-muted-foreground">Score: 60-79 puntos</p>
                <Badge className="mt-2 bg-warning text-warning-foreground text-xs">
                  ⚠️ Revisar manualmente
                </Badge>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-orange-500/10 border-orange-500/30">
            <div className="flex items-start gap-3">
              <Warning size={32} weight="duotone" className="text-orange-600 flex-shrink-0" />
              <div>
                <p className="text-3xl font-bold text-orange-600 tabular-nums">{file.lowConfidence}</p>
                <p className="text-sm font-medium mt-1">Baja Confianza</p>
                <p className="text-xs text-muted-foreground">Score: 40-59 puntos</p>
                <Badge className="mt-2 bg-orange-500 text-white text-xs">
                  🔍 Geocodificar con CartoCiudad
                </Badge>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-destructive/10 border-destructive/30">
            <div className="flex items-start gap-3">
              <XCircle size={32} weight="duotone" className="text-destructive flex-shrink-0" />
              <div>
                <p className="text-3xl font-bold text-destructive tabular-nums">{file.rejected}</p>
                <p className="text-sm font-medium mt-1">Rechazadas</p>
                <p className="text-xs text-muted-foreground">Score: 0-39 puntos</p>
                <Badge className="mt-2 bg-destructive text-destructive-foreground text-xs">
                  ❌ No fiables - descartar
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="original" className="space-y-4">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Fila</th>
                  <th className="px-4 py-3 text-left font-semibold">{file.xColumn}</th>
                  <th className="px-4 py-3 text-left font-semibold">{file.yColumn}</th>
                  <th className="px-4 py-3 text-center font-semibold">Score</th>
                  <th className="px-4 py-3 text-center font-semibold">Clasificación</th>
                  <th className="px-4 py-3 text-center font-semibold">Alertas</th>
                </tr>
              </thead>
              <tbody>
                {displayCoords.map((coord, idx) => (
                  <>
                    <tr
                      key={coord.index}
                      className={`border-t hover:bg-muted/50 cursor-pointer ${
                        (coord.alerts.length > 0 || (coord.corrections && coord.corrections.length > 0)) ? 'bg-warning/5' : ''
                      }`}
                      onClick={() => (coord.alerts.length > 0 || (coord.corrections && coord.corrections.length > 0)) && toggleRow(coord.index)}
                    >
                      <td className="px-4 py-3">{coord.index + 1}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <div className="flex flex-col gap-1">
                          <span>{String(coord.originalX)}</span>
                          {coord.autoFixed && (
                            <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50 w-fit">
                              🔧 Y truncada corregida
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <div className="flex flex-col gap-1">
                          <span>{String(coord.originalY)}</span>
                          {coord.autoFixed && coord.fixReason && (
                            <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50 w-fit">
                              🔧 {coord.fixReason}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="text-sm font-bold tabular-nums">{coord.score}</div>
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                coord.confidence === 'HIGH' || coord.confidence === 'CRÍTICA' ? 'bg-green-500' :
                                coord.confidence === 'MEDIUM' || coord.confidence === 'MEDIA' ? 'bg-yellow-500' :
                                coord.confidence === 'LOW' || coord.confidence === 'BAJA' ? 'bg-orange-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${coord.score}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={getConfidenceColor(coord.confidence)}>{coord.confidence}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {coord.alerts.length > 0 && (
                          <Badge variant="outline" className="border-warning text-warning-foreground">
                            {coord.alerts.length}
                          </Badge>
                        )}
                        {coord.corrections && coord.corrections.length > 0 && (
                          <Badge variant="outline" className="border-blue-500 text-blue-700 ml-1">
                            {coord.corrections.length} fix{coord.corrections.length > 1 ? 'es' : ''}
                          </Badge>
                        )}
                      </td>
                    </tr>
                    {expandedRows.has(coord.index) && (coord.alerts.length > 0 || (coord.corrections && coord.corrections.length > 0)) && (
                      <tr key={`${coord.index}-alerts`}>
                        <td colSpan={6} className="px-4 py-3 bg-warning/5">
                          <div className="space-y-3">
                            {coord.alerts.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold mb-2">Alertas de validación:</p>
                                {coord.alerts.map((alert, i) => (
                                  <div key={i} className="flex items-start gap-2">
                                    <Warning size={14} className="text-warning-foreground mt-0.5 flex-shrink-0" />
                                    <p className="text-xs">{alert}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {coord.corrections && coord.corrections.length > 0 && (
                              <div className="space-y-1 pt-2 border-t border-border">
                                <p className="text-xs font-semibold mb-2">Correcciones aplicadas ({coord.corrections.length}):</p>
                                {coord.corrections.map((corr, i) => (
                                  <div key={i} className="text-xs p-2 bg-blue-50 rounded mb-1 flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-blue-900">{corr.type}</span>: 
                                    <span className="line-through text-red-600 font-mono">{String(corr.from)}</span>
                                    →
                                    <span className="text-green-700 font-mono font-semibold">{String(corr.to)}</span>
                                    <span className="text-gray-500 text-[10px]">({corr.pattern})</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          {filteredCoords.length > 20 && (
            <div className="p-4 text-center text-sm text-muted-foreground border-t">
              Mostrando 20 de {filteredCoords.length} filas
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="validated" className="space-y-4">
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mostrar: Todas</SelectItem>
              <SelectItem value="alta">Solo Alta/Crítica Confianza</SelectItem>
              <SelectItem value="media">Solo Media Confianza</SelectItem>
              <SelectItem value="baja">Solo Baja/Nula Confianza</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {filteredCoords.length} coordenadas
          </p>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Fila</th>
                  <th className="px-4 py-3 text-right font-semibold">X_UTM30 (m)</th>
                  <th className="px-4 py-3 text-right font-semibold">Y_UTM30 (m)</th>
                  <th className="px-4 py-3 text-right font-semibold">Lon_WGS84</th>
                  <th className="px-4 py-3 text-right font-semibold">Lat_WGS84</th>
                  <th className="px-4 py-3 text-center font-semibold">Score</th>
                  <th className="px-4 py-3 text-center font-semibold">Confianza</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {displayCoords.map((coord) => (
                  <tr key={coord.index} className="border-t hover:bg-muted/50">
                    <td className="px-4 py-3">{coord.index + 1}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {coord.utm30_x.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {coord.utm30_y.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {coord.wgs84_lon.toFixed(6)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {coord.wgs84_lat.toFixed(6)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-sm font-bold tabular-nums">{coord.score}</div>
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              coord.confidence === 'HIGH' || coord.confidence === 'CRÍTICA' ? 'bg-green-500' :
                              coord.confidence === 'MEDIUM' || coord.confidence === 'MEDIA' ? 'bg-yellow-500' :
                              coord.confidence === 'LOW' || coord.confidence === 'BAJA' ? 'bg-orange-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${coord.score}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={getConfidenceColor(coord.confidence)}>{coord.confidence}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col gap-1 items-center">
                        {coord.geographicValidation?.isOutlier && (
                          <Badge variant="destructive" className="text-xs">
                            🚨 Outlier ({(coord.geographicValidation.nearestDistance / 1000).toFixed(1)}km)
                          </Badge>
                        )}
                        {coord.hadUTF8Corruption && (
                          <Badge variant="outline" className="text-xs border-slate-300 text-slate-700 bg-slate-50">
                            ℹ️ UTF-8 normalizado
                          </Badge>
                        )}
                        {coord.corrections && coord.corrections.length > 0 && (
                          <Badge variant="outline" className="text-xs border-blue-500 text-blue-700 bg-blue-50">
                            {coord.corrections.length} corrección{coord.corrections.length > 1 ? 'es' : ''}
                          </Badge>
                        )}
                        {coord.alerts.length > 0 && !coord.geographicValidation?.isOutlier && !coord.hadUTF8Corruption && !(coord.corrections && coord.corrections.length > 0) && (
                          <Badge variant="outline" className="border-warning text-warning-foreground text-xs">
                            {coord.alerts.length} alerta{coord.alerts.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredCoords.length > 20 && (
            <div className="p-4 text-center text-sm text-muted-foreground border-t">
              Mostrando 20 de {filteredCoords.length} filas
            </div>
          )}
        </Card>
      </TabsContent>
    </Tabs>
  )
}
