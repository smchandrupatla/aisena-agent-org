import { LayoutDashboard, Globe, DoorOpen } from 'lucide-react'
import { SelectableCard } from '../ui/SelectableCard'
import { useCreateProjectStore } from '../../store/createProjectStore'
import type { ProjectType } from '../../types/project'

const TYPES: {
  type: ProjectType
  title: string
  description: string
  icon: JSX.Element
  examples: string[]
}[] = [
  {
    type: 'web_app',
    title: 'Web App',
    description: 'Interactive, logged-in product experience (dashboards, tools, SaaS)',
    icon: <LayoutDashboard size={28} />,
    examples: ['Analytics dashboard', 'Project management tool', 'SaaS product'],
  },
  {
    type: 'website',
    title: 'Website',
    description: 'Marketing/informational site (landing pages, brochure sites, blogs)',
    icon: <Globe size={28} />,
    examples: ['Product landing page', 'Company brochure site', 'Blog'],
  },
  {
    type: 'portal',
    title: 'Portal',
    description: 'Access-gated hub for a specific audience (customer, partner, internal)',
    icon: <DoorOpen size={28} />,
    examples: ['Customer self-service portal', 'Partner resource hub', 'Internal employee tool'],
  },
]

export function TypeStep() {
  const type = useCreateProjectStore((s) => s.formState.type)
  const setType = useCreateProjectStore((s) => s.setType)

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="text-xl font-semibold">What are you creating?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick the option closest to what you have in mind — you can fine-tune everything in the next
        steps. Hover a card for example use cases.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TYPES.map((t) => (
          <SelectableCard
            key={t.type}
            title={t.title}
            description={t.description}
            icon={t.icon}
            selected={type === t.type}
            onSelect={() => setType(t.type)}
            expandedContent={
              <ul className="list-inside list-disc space-y-0.5">
                {t.examples.map((ex) => (
                  <li key={ex}>{ex}</li>
                ))}
              </ul>
            }
          />
        ))}
      </div>
    </div>
  )
}
