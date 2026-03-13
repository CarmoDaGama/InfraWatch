import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { getDeviceMetrics } from '../api.js'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip)

const WINDOWS = [
  { label: '1 h',  hours: 1   },
  { label: '6 h',  hours: 6   },
  { label: '24 h', hours: 24  },
  { label: '7 d',  hours: 168 },
]

function formatBucket(ts, hours) {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  if (hours <= 2)  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  if (hours <= 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: '2-digit', day: '2-digit' }) +
         ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function MiniStat({ label, value, sub }) {
  return (
    <div className="flex flex-col items-center bg-gray-50 rounded-lg px-3 py-2 min-w-[80px]">
      <span className="text-lg font-bold text-gray-800">{value ?? '—'}</span>
      <span className="text-xs text-gray-500 text-center leading-tight">{label}</span>
      {sub && <span className="text-xs text-gray-400 mt-0.5">{sub}</span>}
    </div>
  )
}

function rt(val) {
  return val != null ? `${Math.round(val)} ms` : '—'
}

export default function MetricsDrawer({ device, onClose }) {
  const [hours,   setHours]   = useState(24)
  const [data,    setData]    = useState(null)   // { metrics, stats }
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const timerRef = useRef(null)

  const fetchMetrics = useCallback(async () => {
    if (!device) return
    try {
      const res = await getDeviceMetrics(device.id, hours)
      setData(res.data)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error ?? err.message)
    } finally {
      setLoading(false)
    }
  }, [device, hours])

  useEffect(() => {
    setLoading(true)
    setData(null)
    fetchMetrics()
    timerRef.current = setInterval(fetchMetrics, 5000)
    return () => clearInterval(timerRef.current)
  }, [fetchMetrics])

  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const metrics = data?.metrics ?? []
  const stats   = data?.stats   ?? {}

  const chartData = {
    labels: metrics.map((m) => formatBucket(m.bucket, hours)),
    datasets: [
      {
        label: 'Response time (ms)',
        data: metrics.map((m) =>
          m.status === 'up' ? (m.response_time != null ? Math.round(m.response_time) : 0) : 0
        ),
        borderColor: 'rgba(59, 130, 246, 0.6)',
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        pointBackgroundColor: metrics.map((m) =>
          m.status === 'up' ? 'rgba(34, 197, 94, 0.85)' : 'rgba(239, 68, 68, 0.9)'
        ),
        pointBorderColor: metrics.map((m) =>
          m.status === 'up' ? 'rgba(22, 163, 74, 1)' : 'rgba(220, 38, 38, 1)'
        ),
        pointRadius: metrics.map((m) => m.status === 'down' ? 5 : 2),
        pointHoverRadius: 6,
        tension: 0.25,
        fill: true,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => items[0]?.label ?? '',
          label: (ctx) => {
            const m = metrics[ctx.dataIndex]
            if (!m) return ''
            if (m.status === 'down') return ' ✗ Down'
            return ` ${ctx.parsed.y} ms (up)`
          },
          afterLabel: (ctx) => {
            const m = metrics[ctx.dataIndex]
            if (m?.check_count > 1) return ` Checks: ${m.check_count}`
            return ''
          },
        },
      },
    },
    scales: {
      y: {
        min: 0,
        ticks: { callback: (v) => `${v} ms` },
        grid: { color: 'rgba(0,0,0,0.04)' },
      },
      x: {
        ticks: {
          maxTicksLimit: 8,
          maxRotation: 0,
          font: { size: 10 },
        },
        grid: { display: false },
      },
    },
  }

  const upPct = stats.total > 0
    ? ((stats.up_count / stats.total) * 100).toFixed(1)
    : null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-50 flex flex-col w-full sm:w-[680px] bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{device.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">{device.url}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1.5 transition-colors shrink-0"
            aria-label="Fechar"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Time window selector */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-2">Janela:</span>
            {WINDOWS.map((w) => (
              <button
                key={w.hours}
                onClick={() => setHours(w.hours)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  hours === w.hours
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {w.label}
              </button>
            ))}
            {loading && (
              <span className="ml-3 inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap gap-2">
            <MiniStat label="Total checks"  value={stats.total}    />
            <MiniStat label="Up"            value={stats.up_count} sub={upPct ? `${upPct}%` : undefined} />
            <MiniStat label="Down"          value={stats.down_count} />
            <MiniStat label="Avg resp."     value={rt(stats.avg_rt)} />
            <MiniStat label="Min resp."     value={rt(stats.min_rt)} />
            <MiniStat label="Max resp."     value={rt(stats.max_rt)} />
          </div>

          {/* Chart */}
          {metrics.length > 0 ? (
            <div>
              <div className="flex items-center gap-4 mb-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" /> Up
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" /> Down
                </span>
              </div>
              <Line data={chartData} options={chartOptions} />
            </div>
          ) : !loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              Sem dados para esta janela temporal.
            </div>
          ) : null}

          {/* Recent down events */}
          {!loading && metrics.some((m) => m.status === 'down') && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Ocorrências de downtime</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {metrics
                  .filter((m) => m.status === 'down')
                  .slice(-20)
                  .reverse()
                  .map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600 bg-red-50 rounded px-3 py-1">
                      <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                      <span className="font-mono">{formatBucket(m.bucket, hours)}</span>
                      {m.check_count > 1 && (
                        <span className="text-gray-400">({m.check_count} checks em down)</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
