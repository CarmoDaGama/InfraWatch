/**
 * DeviceDetail — full-page overlay with live status, SLA config, metrics chart,
 * aggregated stats, and downtime events for a single device.
 *
 * File kept as MetricsDrawer.jsx for backwards compatibility; default export is DeviceDetail.
 */
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
import StatusBadge from './StatusBadge.jsx'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip)

// ─── constants ───────────────────────────────────────────────────────────────

const WINDOWS = [
  { label: '1 h',  hours: 1   },
  { label: '6 h',  hours: 6   },
  { label: '24 h', hours: 24  },
  { label: '7 d',  hours: 168 },
]

const TYPE_LABEL = { http: 'HTTP', ping: 'Ping', snmp: 'SNMP' }
const TYPE_STYLE = {
  http: 'bg-blue-100 text-blue-700',
  ping: 'bg-purple-100 text-purple-700',
  snmp: 'bg-orange-100 text-orange-700',
}

const CRITICALITY_OPTIONS = ['low', 'medium', 'high', 'critical']
const CRITICALITY_LABEL   = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' }
const CRITICALITY_STYLE   = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-yellow-100 text-yellow-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatBucket(ts, hours) {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  if (hours <= 2)  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  if (hours <= 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    d.toLocaleDateString([], { month: '2-digit', day: '2-digit' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  )
}

function formatAge(ts) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 5)    return 'agora mesmo'
  if (diff < 60)   return `há ${diff}s`
  if (diff < 3600) return `há ${Math.floor(diff / 60)}m`
  return new Date(ts).toLocaleTimeString()
}

function rt(val) {
  return val != null ? `${Math.round(val)} ms` : '—'
}

// ─── sub-components ──────────────────────────────────────────────────────────

function Card({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow p-5 ${className}`}>
      {title && <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>}
      {children}
    </div>
  )
}

function StatRow({ label, value, valueClass = 'text-gray-800' }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium ${valueClass}`}>{value ?? '—'}</span>
    </div>
  )
}

function SlaStatusBadge({ sla_met }) {
  if (sla_met === null || sla_met === undefined) {
    return <span className="text-xs text-gray-400">Sem dados</span>
  }
  return sla_met ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
      ✓ SLA cumprido
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
      ✗ SLA violado
    </span>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function DeviceDetail({ device, onClose, onUpdate }) {
  // Metrics state
  const [hours,   setHours]   = useState(24)
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const timerRef = useRef(null)

  // SLA edit state — seeded from device prop, re-synced on device changes (when not editing)
  const [editing,    setEditing]    = useState(false)
  const [slaTarget,  setSlaTarget]  = useState(String(device.sla_target ?? 99.0))
  const [critVal,    setCritVal]    = useState(device.criticality ?? 'medium')
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState(null)

  // Sync SLA fields when parent updates device (live refresh)
  useEffect(() => {
    if (!editing) {
      setSlaTarget(String(device.sla_target ?? 99.0))
      setCritVal(device.criticality ?? 'medium')
    }
  }, [device.sla_target, device.criticality, editing])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Metrics fetching
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await getDeviceMetrics(device.id, hours)
      setData(res.data)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error ?? err.message)
    } finally {
      setLoading(false)
    }
  }, [device.id, hours])

  useEffect(() => {
    setLoading(true)
    setData(null)
    fetchMetrics()
    timerRef.current = setInterval(fetchMetrics, 5000)
    return () => clearInterval(timerRef.current)
  }, [fetchMetrics])

  // Escape key to close
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSaveSla() {
    const num = parseFloat(slaTarget)
    if (isNaN(num) || num < 0 || num > 100) {
      setSaveError('SLA deve ser um número entre 0 e 100.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await onUpdate(device.id, { sla_target: num, criticality: critVal })
      setEditing(false)
    } catch (err) {
      setSaveError(err.response?.data?.error ?? err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── computed values ────────────────────────────────────────────────────────
  const metrics   = data?.metrics ?? []
  const stats     = data?.stats   ?? {}
  const uptime_pct = stats.total > 0
    ? ((stats.up_count / stats.total) * 100).toFixed(1)
    : null
  const sla_met = uptime_pct !== null
    ? parseFloat(uptime_pct) >= parseFloat(slaTarget)
    : null

  // ── chart ─────────────────────────────────────────────────────────────────
  const chartData = {
    labels: metrics.map((m) => formatBucket(m.bucket, hours)),
    datasets: [{
      label: 'Response time (ms)',
      data: metrics.map((m) =>
        m.status === 'up' ? (m.response_time != null ? Math.round(m.response_time) : 0) : 0
      ),
      borderColor: 'rgba(59, 130, 246, 0.5)',
      backgroundColor: 'rgba(59, 130, 246, 0.04)',
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
    }],
  }

  const chartOptions = {
    responsive: true,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title:       (items) => items[0]?.label ?? '',
          label:       (ctx)   => {
            const m = metrics[ctx.dataIndex]
            if (!m) return ''
            return m.status === 'down' ? ' ✗ Down' : ` ${ctx.parsed.y} ms (up)`
          },
          afterLabel:  (ctx)   => {
            const m = metrics[ctx.dataIndex]
            return m?.check_count > 1 ? ` Checks: ${m.check_count}` : ''
          },
        },
      },
    },
    scales: {
      y: {
        min: 0,
        ticks: { callback: (v) => `${v} ms` },
        grid:  { color: 'rgba(0,0,0,0.04)' },
      },
      x: {
        ticks: { maxTicksLimit: 8, maxRotation: 0, font: { size: 10 } },
        grid:  { display: false },
      },
    },
  }

  // ── render ─────────────────────────────────────────────────────────────────
  const typeCls   = TYPE_STYLE[device.type]  ?? 'bg-gray-100 text-gray-600'
  const typeLabel = TYPE_LABEL[device.type]  ?? device.type

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">

      {/* ── sticky header ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-start gap-4">

          {/* Back button */}
          <button
            onClick={onClose}
            className="mt-0.5 shrink-0 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
            </svg>
            Voltar
          </button>

          {/* Device title block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeCls}`}>
                {typeLabel}
              </span>
              <h1 className="text-xl font-bold text-gray-900 truncate">{device.name}</h1>
              <StatusBadge status={device.status} />
            </div>
            <div className="flex items-center gap-4 mt-0.5 text-xs text-gray-400 flex-wrap">
              <span className="font-mono truncate">{device.url}</span>
              {device.lastChecked && (
                <span>Último check: {formatAge(device.lastChecked)}</span>
              )}
              {device.responseTime != null && (
                <span>{device.responseTime} ms</span>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── page content ──────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── top cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Card 1 — Status atual */}
          <Card title="Estado atual">
            <div className="flex items-center gap-4">
              {/* Big status circle */}
              <span className={`shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
                device.status === 'up'   ? 'bg-green-100' :
                device.status === 'down' ? 'bg-red-100 animate-pulse' :
                'bg-gray-100'
              }`}>
                {device.status === 'up' ? '🟢' : device.status === 'down' ? '🔴' : '⚪'}
              </span>
              <div>
                <p className={`text-lg font-bold ${
                  device.status === 'up' ? 'text-green-700' :
                  device.status === 'down' ? 'text-red-700' : 'text-gray-500'
                }`}>
                  {device.status === 'up' ? 'Operacional' : device.status === 'down' ? 'Offline' : 'Desconhecido'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {device.lastChecked ? formatAge(device.lastChecked) : 'Nunca verificado'}
                </p>
              </div>
            </div>
            {device.type === 'http' || device.type === 'ping' ? (
              <div className="mt-4 space-y-0">
                <StatRow label="Tempo de resposta" value={device.responseTime != null ? `${device.responseTime} ms` : '—'} />
              </div>
            ) : null}
            {device.type === 'snmp' && (
              <div className="mt-4 space-y-0 text-xs text-gray-500">
                <StatRow label="Community"   value={device.snmp_community} />
                <StatRow label="OID"         value={<span className="font-mono text-xs">{device.snmp_oid}</span>} />
                <StatRow label="Port"        value={device.snmp_port} />
              </div>
            )}
          </Card>

          {/* Card 2 — SLA & Criticidade */}
          <Card title="SLA & Criticidade">
            {!editing ? (
              <>
                <div className="space-y-0 mb-4">
                  <StatRow
                    label="Criticidade"
                    value={
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CRITICALITY_STYLE[device.criticality] ?? 'bg-gray-100 text-gray-600'}`}>
                        {CRITICALITY_LABEL[device.criticality] ?? device.criticality}
                      </span>
                    }
                  />
                  <StatRow label="Target SLA"   value={`${device.sla_target ?? 99.0}%`} />
                  <StatRow label="Uptime real"  value={uptime_pct !== null ? `${uptime_pct}%` : '—'} />
                </div>
                <div className="flex items-center justify-between">
                  <SlaStatusBadge sla_met={sla_met} />
                  <button
                    onClick={() => { setEditing(true); setSaveError(null) }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Editar SLA
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Criticidade</label>
                    <select
                      value={critVal}
                      onChange={(e) => setCritVal(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {CRITICALITY_OPTIONS.map((o) => (
                        <option key={o} value={o}>{CRITICALITY_LABEL[o]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Target SLA (%)</label>
                    <input
                      type="number" min="0" max="100" step="0.1"
                      value={slaTarget}
                      onChange={(e) => setSlaTarget(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {saveError && <p className="text-xs text-red-600 mb-2">{saveError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveSla}
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                  >
                    {saving ? 'A guardar…' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setSaveError(null) }}
                    disabled={saving}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </Card>

          {/* Card 3 — Estatísticas do período */}
          <Card title={`Estatísticas · ${WINDOWS.find(w => w.hours === hours)?.label ?? `${hours}h`}`}>
            {loading && !data ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-0">
                <StatRow label="Total checks"    value={stats.total}     />
                <StatRow label="Up"              value={stats.up_count}  valueClass="text-green-700 font-semibold" />
                <StatRow label="Down"            value={stats.down_count} valueClass={stats.down_count > 0 ? 'text-red-700 font-semibold' : 'text-gray-800'} />
                <StatRow label="Uptime"          value={uptime_pct !== null ? `${uptime_pct}%` : '—'} />
                <StatRow label="Média resp."     value={rt(stats.avg_rt)} />
                <StatRow label="Mín / Máx resp." value={`${rt(stats.min_rt)} / ${rt(stats.max_rt)}`} />
              </div>
            )}
          </Card>

        </div>

        {/* ── metrics chart ────────────────────────────────────────────── */}
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Histórico de resposta
            </h3>
            <div className="flex items-center gap-1 flex-wrap">
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
                <span className="ml-1 inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" /> Up
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" /> Down
            </span>
          </div>

          {metrics.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : !loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              Sem dados para esta janela temporal.
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </Card>

        {/* ── downtime events ──────────────────────────────────────────── */}
        {!loading && metrics.some((m) => m.status === 'down') && (
          <Card title="Ocorrências de downtime">
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {metrics
                .filter((m) => m.status === 'down')
                .slice(-30)
                .reverse()
                .map((m, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm bg-red-50 rounded-lg px-3 py-2">
                    <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                    <span className="font-mono text-xs text-gray-600">{formatBucket(m.bucket, hours)}</span>
                    {m.check_count > 1 && (
                      <span className="text-xs text-gray-400 ml-auto">
                        {m.check_count} checks em down
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </Card>
        )}

      </div>
    </div>
  )
}
