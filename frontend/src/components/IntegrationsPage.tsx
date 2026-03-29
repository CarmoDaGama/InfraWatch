import IntegrationEventsLog from './IntegrationEventsLog'
import IntegrationConfigPanel from './IntegrationConfigPanel'

export default function IntegrationsPage() {
  return (
    <main className="page-frame">
      <IntegrationConfigPanel />
      <IntegrationEventsLog />
    </main>
  )
}
