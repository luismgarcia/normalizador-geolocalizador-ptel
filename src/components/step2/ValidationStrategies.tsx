import { useState } from 'react'
import {
  MapPin,
  Warning,
  CheckCircle,
  NumberCircleOne,
  ArrowsClockwise,
  Globe,
  Stack
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ProcessedFile } from '@/lib/types'
import { VALIDATION_STRATEGIES } from '@/lib/validation'

interface ValidationStrategiesProps {
  file: ProcessedFile
}

const STRATEGY_ICONS: Record<string, any> = {
  MapPin,
  Warning,
  CheckCircle,
  NumberCircleOne,
  ArrowsClockwise,
  Globe,
  Stack
}

export function ValidationStrategies({ file }: ValidationStrategiesProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Card className="bg-muted/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full p-6 h-auto justify-between hover:bg-muted">
            <div className="text-left">
              <p className="text-lg font-semibold mb-1">Sistema de Validación Defensiva (8 Estrategias)</p>
              <p className="text-sm text-muted-foreground">
                Haz clic para ver detalles de cada estrategia
              </p>
            </div>
            <div className="text-2xl">{isOpen ? '−' : '+'}</div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="px-6 pb-6">
          <div className="grid md:grid-cols-2 gap-4 pt-4">
            {VALIDATION_STRATEGIES.map((strategy, index) => {
              const Icon = STRATEGY_ICONS[strategy.icon]
              const isImportant = strategy.maxPoints === 20

              return (
                <Card
                  key={index}
                  className={`p-4 ${isImportant ? 'border-2 border-warning/50 bg-warning/5' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${isImportant ? 'bg-warning/20' : 'bg-primary/10'}`}>
                      <Icon
                        size={24}
                        weight="duotone"
                        className={isImportant ? 'text-warning-foreground' : 'text-primary'}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-sm">
                          ESTRATEGIA #{index + 1}: {strategy.name}
                          {isImportant && <span className="ml-2">⭐</span>}
                        </p>
                        <span className="text-xs font-bold text-primary tabular-nums flex-shrink-0">
                          {strategy.maxPoints} pts
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {strategy.description}
                      </p>
                      {isImportant && (
                        <p className="text-xs font-medium text-warning-foreground mt-2">
                          MÁS IMPORTANTE - Mayor peso en la puntuación
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          <div className="mt-6 p-4 bg-accent/10 rounded-lg border border-accent/30">
            <p className="text-sm">
              <span className="font-semibold">Nota:</span> Cada coordenada es evaluada
              independientemente con estas 8 estrategias. La puntuación total (0-100 puntos)
              determina el nivel de confianza y la recomendación de uso.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
