import { useTranslation } from 'react-i18next'
import UptimeChart from './UptimeChart'
import SlaPanel from './SlaPanel'

function StatCard({ label, value, color }) {
  return (
    <div className="glass-card px-6 py-5 flex flex-col gap-2">
      <span className="text-xs uppercase tracking-[0.14em] text-slate-500 font-bold">{label}</span>
      <span className={`text-3xl font-extrabold ${color}`}>{value}</span>
    </div>
  )
}

export default function DashboardPage({ devices, uptimeStats, onUpdate, canUpdate }) {
  const { t } = useTranslation()

  const upCount = devices.filter((d) => d.status === 'up').length
  const downCount = devices.filter((d) => d.status === 'down').length

  return (
    <main className="page-frame">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="section-title">Operational Overview</h2>
          <p className="section-subtitle">Uptime, health and SLA performance in one view.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t('app.totalDevices')} value={devices.length} color="text-gray-800" />
        <StatCard label={t('app.up')} value={upCount} color="text-emerald-600" />
        <StatCard label={t('app.down')} value={downCount} color="text-rose-600" />
      </div>

      <UptimeChart uptimeStats={uptimeStats} />

      <SlaPanel uptimeStats={uptimeStats} onUpdate={onUpdate} canEdit={canUpdate} />
    </main>
  )
}
