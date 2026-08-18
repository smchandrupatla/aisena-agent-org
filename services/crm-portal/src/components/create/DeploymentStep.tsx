import { Container, AppWindow, Cloud } from 'lucide-react'
import { useCreateProjectStore } from '../../store/createProjectStore'
import { SelectableCard } from '../ui/SelectableCard'
import { Toggle } from '../ui/Toggle'
import { Field } from '../ui/Field'
import { CLOUD_PROVIDERS } from '../../lib/mockData'
import { suggestBaseImage, suggestPackagingTool, DEFAULT_EXPOSED_PORT } from '../../lib/deploymentDefaults'
import type { DeploymentTarget } from '../../types/project'

export function DeploymentStep() {
  const type = useCreateProjectStore((s) => s.formState.type)
  const formState = useCreateProjectStore((s) => s.formState)
  const updateField = useCreateProjectStore((s) => s.updateField)
  const deployment = formState.deployment
  const framework = (formState.config as { framework?: string }).framework

  function toggleTarget(target: DeploymentTarget) {
    const active = deployment.targets.includes(target)
    const nextTargets = active ? deployment.targets.filter((t) => t !== target) : [...deployment.targets, target]
    updateField('deployment.targets', nextTargets)
    if (!active) {
      if (target === 'docker' && !deployment.docker) {
        updateField('deployment.docker', {
          baseImage: suggestBaseImage(framework),
          exposedPort: DEFAULT_EXPOSED_PORT,
          includeCompose: Boolean(formState.enterpriseFeatures.database?.enabled),
          registry: 'none',
        })
      }
      if (target === 'executable' && !deployment.executable) {
        updateField('deployment.executable', {
          targetOS: [],
          packagingTool: suggestPackagingTool(framework),
          autoUpdate: false,
          codeSigning: false,
        })
      }
      if (target === 'cloud' && !deployment.cloud) {
        updateField('deployment.cloud', {
          provider: 'aws',
          region: CLOUD_PROVIDERS[0].regions[0],
          environment: 'development',
          autoDeployOnPush: false,
        })
      }
    }
  }

  const cards: { target: DeploymentTarget; title: string; description: string; icon: JSX.Element; hidden?: boolean }[] = [
    { target: 'docker', title: 'Docker', description: 'Containerized, runs anywhere Docker runs', icon: <Container size={24} /> },
    {
      target: 'executable',
      title: 'Executable (.exe/.app)',
      description: 'Standalone native desktop binary',
      icon: <AppWindow size={24} />,
      hidden: type === 'website',
    },
    { target: 'cloud', title: 'Cloud Service', description: 'Deployed directly to a managed cloud provider', icon: <Cloud size={24} /> },
  ]

  const selectedProvider = CLOUD_PROVIDERS.find((p) => p.value === deployment.cloud?.provider) ?? CLOUD_PROVIDERS[0]

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-semibold">Deployment Target</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose how this will be packaged and run — select more than one if it applies (e.g. Docker +
        Cloud Service).
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards
          .filter((c) => !c.hidden)
          .map((c) => (
            <SelectableCard
              key={c.target}
              title={c.title}
              description={c.description}
              icon={c.icon}
              selected={deployment.targets.includes(c.target)}
              onSelect={() => toggleTarget(c.target)}
            />
          ))}
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {deployment.targets.includes('docker') && deployment.docker && (
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold">Docker</h3>
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Base image" hint="Auto-suggested from your framework choice — editable">
                <input
                  value={deployment.docker.baseImage}
                  onChange={(e) => updateField('deployment.docker', { ...deployment.docker, baseImage: e.target.value })}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Exposed port">
                <input
                  type="number"
                  value={deployment.docker.exposedPort}
                  onChange={(e) => updateField('deployment.docker', { ...deployment.docker, exposedPort: Number(e.target.value) })}
                  className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Toggle
                label="Include a docker-compose.yml?"
                description="Useful if the config includes a database"
                checked={deployment.docker.includeCompose}
                onChange={(v) => updateField('deployment.docker', { ...deployment.docker, includeCompose: v })}
              />
              <Field label="Registry target">
                <div className="grid grid-cols-3 gap-2">
                  {(['dockerhub', 'private', 'none'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => updateField('deployment.docker', { ...deployment.docker, registry: opt })}
                      className={`rounded-md border px-2 py-1.5 text-xs capitalize ${
                        deployment.docker?.registry === opt ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                      }`}
                    >
                      {opt === 'none' ? 'Build locally only' : opt}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>
        )}

        {deployment.targets.includes('executable') && deployment.executable && (
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold">Executable</h3>
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Target OS">
                <div className="flex gap-4">
                  {(['windows', 'macos', 'linux'] as const).map((os) => (
                    <label key={os} className="flex items-center gap-2 text-sm capitalize">
                      <input
                        type="checkbox"
                        checked={deployment.executable!.targetOS.includes(os)}
                        onChange={() => {
                          const set = deployment.executable!.targetOS
                          const next = set.includes(os) ? set.filter((o) => o !== os) : [...set, os]
                          updateField('deployment.executable', { ...deployment.executable, targetOS: next })
                        }}
                      />
                      {os === 'macos' ? 'macOS' : os}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Packaging tool" hint="Auto-suggested by framework — editable">
                <input
                  value={deployment.executable.packagingTool}
                  onChange={(e) => updateField('deployment.executable', { ...deployment.executable, packagingTool: e.target.value })}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Toggle
                label="Auto-update support"
                description="Packaged app checks for updates"
                checked={deployment.executable.autoUpdate}
                onChange={(v) => updateField('deployment.executable', { ...deployment.executable, autoUpdate: v })}
              />
              <Toggle
                label="Code signing"
                description="You'll need to supply certs later — doesn't block creation"
                checked={deployment.executable.codeSigning}
                onChange={(v) => updateField('deployment.executable', { ...deployment.executable, codeSigning: v })}
              />
            </div>
          </div>
        )}

        {deployment.targets.includes('cloud') && deployment.cloud && (
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold">Cloud Service</h3>
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Provider">
                <select
                  value={deployment.cloud.provider}
                  onChange={(e) => {
                    const provider = CLOUD_PROVIDERS.find((p) => p.value === e.target.value) ?? CLOUD_PROVIDERS[0]
                    updateField('deployment.cloud', { ...deployment.cloud, provider: provider.value, region: provider.regions[0] })
                  }}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {CLOUD_PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Region">
                <select
                  value={deployment.cloud.region}
                  onChange={(e) => updateField('deployment.cloud', { ...deployment.cloud, region: e.target.value })}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {selectedProvider.regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Environment">
                <div className="grid grid-cols-3 gap-2">
                  {(['development', 'staging', 'production'] as const).map((env) => (
                    <button
                      key={env}
                      type="button"
                      onClick={() => updateField('deployment.cloud', { ...deployment.cloud, environment: env })}
                      className={`rounded-md border px-2 py-1.5 text-xs capitalize ${
                        deployment.cloud?.environment === env ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                      }`}
                    >
                      {env}
                    </button>
                  ))}
                </div>
              </Field>
              <Toggle
                label="Auto-deploy on push?"
                description="Connects a repo/CI hook"
                checked={deployment.cloud.autoDeployOnPush}
                onChange={(v) => updateField('deployment.cloud', { ...deployment.cloud, autoDeployOnPush: v })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
