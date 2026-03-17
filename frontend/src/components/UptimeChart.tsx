import { useTranslation } from 'react-i18next'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

function barColor(stat) {
  if (stat.uptime_pct === null) return 'rgba(156, 163, 175, 0.6)'
  if (stat.sla_met === true)   return 'rgba(34, 197, 94, 0.75)'
  return 'rgba(239, 68, 68, 0.75)'
}

function barBorder(stat) {
  if (stat.uptime_pct === null) return 'rgba(107, 114, 128, 1)'
  if (stat.sla_met === true)   return 'rgba(22, 163, 74, 1)'
  return 'rgba(220, 38, 38, 1)'
}

export default function UptimeChart({ uptimeStats }) {
  const { t } = useTranslation()

  if (!uptimeStats || uptimeStats.length === 0) {
    return (
      <div className="glass-card p-6">
        <h2 className="text-lg font-extrabold text-slate-800 mb-4">{t('uptime.title')}</h2>
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm font-medium">
          {t('uptime.noData')}
        </div>
      </div>
    )
  }

  const data = {
    labels: uptimeStats.map((s) => s.name),
    datasets: [
      {
        label: t('uptime.uptimeLabel'),
        data: uptimeStats.map((s) => s.uptime_pct ?? 0),
        backgroundColor: uptimeStats.map(barColor),
        borderColor: uptimeStats.map(barBorder),
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const stat = uptimeStats[ctx.dataIndex]
            const uptime = stat.uptime_pct !== null ? `${stat.uptime_pct.toFixed(1)}%` : 'N/A'
            const target = `${t('uptime.tooltipTarget')}: ${stat.sla_target ?? 99.0}%`
            const status = stat.sla_met === null
              ? t('uptime.noDataLegend')
              : stat.sla_met
                ? `✓ ${t('uptime.slaOk')}`
                : `✗ ${t('uptime.slaViolated')}`
            return [`${t('uptime.tooltipUptime')}: ${uptime}`, target, status]
          },
        },
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: { callback: (v) => `${v}%` },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      x: { grid: { display: false } },
    },
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-slate-800">{t('uptime.title')}</h2>
        <div className="flex items-center gap-4 text-xs text-slate-600 font-semibold">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-green-400" /> {t('uptime.slaOk')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-400" /> {t('uptime.slaViolated')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-gray-400" /> {t('uptime.noDataLegend')}
          </span>
        </div>
      </div>
      <Bar data={data} options={options} />
    </div>
  )
}
