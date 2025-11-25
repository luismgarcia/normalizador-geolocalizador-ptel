import { motion } from 'framer-motion'
import { NumberCircleOne, NumberCircleTwo, NumberCircleThree } from '@phosphor-icons/react'
import { WizardStep } from '@/lib/types'

interface StepIndicatorProps {
  currentStep: WizardStep
  completedSteps: WizardStep[]
  onStepClick: (step: WizardStep) => void
}

export function StepIndicator({ currentStep, completedSteps, onStepClick }: StepIndicatorProps) {
  const steps = [
    { number: 1 as WizardStep, icon: NumberCircleOne, label: 'Subir archivos' },
    { number: 2 as WizardStep, icon: NumberCircleTwo, label: 'Validar y analizar' },
    { number: 3 as WizardStep, icon: NumberCircleThree, label: 'Descargar resultados' }
  ]

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 mb-8 overflow-x-auto px-4">
      {steps.map((step, index) => {
        const Icon = step.icon
        const isActive = currentStep === step.number
        const isCompleted = completedSteps.includes(step.number)
        const isClickable = isCompleted && !isActive

        return (
          <div key={step.number} className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
            <motion.button
              onClick={() => isClickable && onStepClick(step.number)}
              disabled={!isClickable}
              className={`flex flex-col items-center gap-1 sm:gap-2 min-w-[80px] sm:min-w-[100px] md:min-w-[140px] transition-all ${
                isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-default'
              }`}
              whileHover={isClickable ? { scale: 1.05 } : {}}
              whileTap={isClickable ? { scale: 0.98 } : {}}
            >
              <Icon
                size={48}
                weight={isActive ? 'fill' : 'regular'}
                className={`transition-colors ${
                  isActive
                    ? 'text-primary'
                    : isCompleted
                    ? 'text-success'
                    : 'text-muted-foreground'
                }`}
              />
              <div className="text-center">
                <p
                  className={`text-xs sm:text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary font-semibold'
                      : isCompleted
                      ? 'text-success'
                      : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </p>
              </div>
            </motion.button>

            {index < steps.length - 1 && (
              <div className="h-[48px] flex items-center shrink-0">
                <div
                  className={`h-[3px] w-12 sm:w-20 md:w-24 lg:w-32 transition-colors ${
                    completedSteps.includes(step.number) ? 'bg-success/20' : 'bg-border/30'
                  }`}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
