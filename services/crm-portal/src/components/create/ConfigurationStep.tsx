import { useCreateProjectStore } from '../../store/createProjectStore'
import { WebAppConfigForm } from './config-forms/WebAppConfigForm'
import { WebsiteConfigForm } from './config-forms/WebsiteConfigForm'
import { PortalConfigForm } from './config-forms/PortalConfigForm'
import type { PortalConfig, WebAppConfig, WebsiteConfig } from '../../types/project'

export function ConfigurationStep() {
  const type = useCreateProjectStore((s) => s.formState.type)
  const config = useCreateProjectStore((s) => s.formState.config)
  const updateField = useCreateProjectStore((s) => s.updateField)

  function mergeConfig(patch: Record<string, unknown>) {
    updateField('config', { ...config, ...patch })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-semibold">Configuration</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Fields adapt to the project type you chose — {type ? type.replace('_', ' ') : 'none selected'}.
      </p>
      <div className="mt-6">
        {type === 'web_app' && (
          <WebAppConfigForm value={config as Partial<WebAppConfig>} onChange={mergeConfig} />
        )}
        {type === 'website' && (
          <WebsiteConfigForm value={config as Partial<WebsiteConfig>} onChange={mergeConfig} />
        )}
        {type === 'portal' && (
          <PortalConfigForm value={config as Partial<PortalConfig>} onChange={mergeConfig} />
        )}
        {!type && <p className="text-sm text-muted-foreground">Go back and choose a type first.</p>}
      </div>
    </div>
  )
}
