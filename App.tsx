import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from '@/components/ui/sonner'
import { StepIndicator } from '@/components/StepIndicator'
import { Step1 } from '@/components/Step1'
import { Step2 } from '@/components/Step2'
import { Step3 } from '@/components/Step3'
import { ProcessedFile, WizardStep } from '@/lib/types'

/**
 * Normalizador-Geolocalizador PTEL Andalucía
 * 
 * Aplicación consolidada que integra:
 * - Sistema de normalización de coordenadas v2.0 (52 patrones)
 * - Geocodificación tipológica WFS (salud, educación, cultural, seguridad)
 * - Clasificación automática de infraestructuras
 * - Wizard de 3 pasos para procesamiento guiado
 * - Exportación multi-formato compatible QGIS
 * 
 * Sistema objetivo: EPSG:25830 (UTM30 ETRS89)
 * Ámbito: 786 municipios andaluces
 * Precisión objetivo: ≤25 metros
 */
function App() {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([])
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<string>('')

  const handleFilesProcessed = (files: ProcessedFile[]) => {
    setProcessedFiles(prev => [...prev, ...files])
    if (files.length > 0 && !selectedFileId) {
      setSelectedFileId(files[0].id)
    }
    setCurrentStep(2)
    if (!completedSteps.includes(1)) {
      setCompletedSteps(prev => [...prev, 1])
    }
  }

  const handleContinueToDownload = () => {
    setCurrentStep(3)
    if (!completedSteps.includes(2)) {
      setCompletedSteps(prev => [...prev, 2])
    }
  }

  const handleBackToAnalysis = () => {
    setCurrentStep(2)
  }

  const handleReset = () => {
    setCurrentStep(1)
    setCompletedSteps([])
    setProcessedFiles([])
    setSelectedFileId('')
  }

  const handleNewFiles = () => {
    setCurrentStep(1)
  }

  const handleStepClick = (step: WizardStep) => {
    if (completedSteps.includes(step)) {
      setCurrentStep(step)
    }
  }

  const handleRemoveFile = (fileId: string) => {
    setProcessedFiles(prev => {
      const filtered = prev.filter(f => f.id !== fileId)
      if (filtered.length === 0) {
        handleReset()
      } else if (selectedFileId === fileId) {
        setSelectedFileId(filtered[0].id)
      }
      return filtered
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" />
      
      <div className="container mx-auto px-4 py-8 md:px-8 lg:px-12 max-w-7xl">
        <header className="text-center mb-8 space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Normalizador-Geolocalizador PTEL
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground font-medium">
            Planes Territoriales de Emergencias - Andalucía
          </p>
          <p className="text-sm text-muted-foreground">
            Normalización · Geocodificación Tipológica · Validación Multivariable · Conversión UTM30
          </p>
        </header>

        <StepIndicator
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={handleStepClick}
        />

        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <Step1 key="step1" onFilesProcessed={handleFilesProcessed} />
          )}
          
          {currentStep === 2 && processedFiles.length > 0 && (
            <Step2
              key="step2"
              files={processedFiles}
              onContinue={handleContinueToDownload}
              onReset={handleReset}
              onRemoveFile={handleRemoveFile}
            />
          )}
          
          {currentStep === 3 && processedFiles.length > 0 && (
            <Step3
              key="step3"
              files={processedFiles}
              selectedFileId={selectedFileId}
              onBack={handleBackToAnalysis}
              onReset={handleReset}
              onNewFiles={handleNewFiles}
            />
          )}
        </AnimatePresence>

        <footer className="mt-12 text-center text-sm text-muted-foreground space-y-1">
          <p>Compatible con QGIS · EPSG:25830 (UTM30N ETRS89)</p>
          <p className="text-xs">
            786 municipios · 52 patrones de coordenadas · Geocodificación WFS tipológica
          </p>
        </footer>
      </div>
    </div>
  )
}

export default App
