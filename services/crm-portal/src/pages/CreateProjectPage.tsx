import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useCreateProjectStore } from '../store/createProjectStore'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Stepper } from '../components/create/Stepper'
import { NavButtons } from '../components/create/NavButtons'
import { TypeStep } from '../components/create/TypeStep'
import { BasicsStep } from '../components/create/BasicsStep'
import { ConfigurationStep } from '../components/create/ConfigurationStep'
import { EnterpriseFeaturesStep } from '../components/create/EnterpriseFeaturesStep'
import { DeploymentStep } from '../components/create/DeploymentStep'
import { ReviewStep } from '../components/create/ReviewStep'
import { SidePanel } from '../components/create/SidePanel'
import { validateType, validateBasics, validateConfiguration, validateEnterpriseFeatures, validateDeployment } from '../lib/validation'

export function CreateProjectPage() {
  const navigate = useNavigate()
  const step = useCreateProjectStore((s) => s.step)
  const setStep = useCreateProjectStore((s) => s.setStep)
  const next = useCreateProjectStore((s) => s.next)
  const back = useCreateProjectStore((s) => s.back)
  const formState = useCreateProjectStore((s) => s.formState)
  const nameUniqueStatus = useCreateProjectStore((s) => s.nameUniqueStatus)
  const dirty = useCreateProjectStore((s) => s.dirty)
  const [furthestReached, setFurthestReached] = useState(0)

  useEffect(() => {
    setFurthestReached((f) => Math.max(f, step))
  }, [step])

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  const validation = useMemo(() => {
    switch (step) {
      case 0:
        return validateType(formState)
      case 1:
        return validateBasics(formState, nameUniqueStatus)
      case 2:
        return validateConfiguration(formState)
      case 3:
        return validateEnterpriseFeatures(formState)
      case 4:
        return validateDeployment(formState)
      default:
        return { errors: [], warnings: [] }
    }
  }, [step, formState, nameUniqueStatus])

  function handleClose() {
    if (dirty && !window.confirm('Discard unsaved project?')) return
    navigate('/')
  }

  const stepComponents = [
    <TypeStep key="type" />,
    <BasicsStep key="basics" />,
    <ConfigurationStep key="config" />,
    <EnterpriseFeaturesStep key="enterprise" />,
    <DeploymentStep key="deployment" />,
    <ReviewStep key="review" />,
  ]

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="text-sm font-semibold">Create New Project</div>
        <button type="button" onClick={handleClose} className="text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>
      </div>
      <Stepper current={step} furthestReached={furthestReached} onJump={setStep} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-8">{stepComponents[step]}</div>
          {step < 5 && (
            <NavButtons
              canGoBack={step > 0}
              onBack={back}
              onNext={() => {
                if (validation.errors.length === 0) next()
              }}
              errors={validation.errors}
              warnings={validation.warnings}
            />
          )}
        </div>
        <div className="relative w-[360px] shrink-0">
          <SidePanel />
        </div>
      </div>
    </div>
  )
}
