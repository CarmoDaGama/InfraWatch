import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  HiArrowPath,
  HiArrowUpTray,
  HiArrowDownTray,
  HiCheckCircle,
  HiExclamationCircle,
  HiLink,
  HiXMark,
} from 'react-icons/hi2'
import { getIntegrationEvents } from '../api'

const PROVIDER_BADGE = {
  glpi: 'bg-blue-100 text-blue-700',
  docuware: 'bg-purple-100 text-purple-700',
}

const PROVIDER_LABEL = {
  glpi: 'GLPI',
  docuware: 'DocuWare',
}

const STATUS_BADGE = {
  success: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  accepted: 'bg-blue-100 text-blue-700',
}

function ProviderBadge({ provider }) {
  const cls = PROVIDER_BADGE[provider] ?? 'bg-gray-100 text-gray-600'
  const label = PROVIDER_LABEL[provider] ?? provider
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-600'
  const Icon = status === 'failed' ? HiExclamationCircle : HiCheckCircle
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      <Icon className="w-3.5 h-3.5 mr-1" />
      {status}
    </span>
  )
}

function formatTimestamp(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function IntegrationEventsLog() {
  const { t } = useTranslation()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)

  async function fetchEvents() {
    setLoading(true)
    try {
      const res = await getIntegrationEvents(100)
      setEvents(res.data.events || [])
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
    const timer = setInterval(fetchEvents, 5000) // Refresh every 5 seconds
    return () => clearInterval(timer)
  }, [])

  if (!events || events.length === 0) {
    return (
      <div className="glass-card p-6">
        <h2 className="section-title mb-2 flex items-center gap-2">
          <HiLink className="w-5 h-5 text-teal-600" />
          {t('integrations.title') || 'Integration Events'}
        </h2>
        <p className="section-subtitle mb-4">Track outbound and inbound integration activity in real time.</p>
        <div className="flex items-center justify-center h-40 text-slate-500 text-sm font-medium">
          {loading ? t('app.loading') : t('integrations.noEvents') || 'No integration events yet'}
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200/70 flex items-center justify-between">
        <div>
        <h2 className="section-title flex items-center gap-2">
          <HiLink className="w-5 h-5 text-teal-600" />
          {t('integrations.title') || 'Integration Events'}
        </h2>
        <p className="section-subtitle mt-0.5">Realtime log for GLPI and DocuWare webhooks.</p>
        </div>
        <button
          onClick={fetchEvents}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-1">
            <HiArrowPath className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </span>
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200/70">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t('integrations.time') || 'Time'}
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t('integrations.direction') || 'Direction'}
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t('integrations.provider') || 'Provider'}
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t('integrations.event') || 'Event'}
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t('integrations.status') || 'Status'}
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t('integrations.message') || 'Message'}
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t('integrations.actions') || 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70">
            {events.map((event) => (
              <tr key={event.id} className={event.status === 'failed' ? 'bg-red-50/70 hover:bg-red-100/70' : 'hover:bg-slate-50/80'}>
                <td className="px-6 py-3 text-xs text-slate-500 whitespace-nowrap font-medium">
                  {formatTimestamp(event.timestamp)}
                </td>
                <td className="px-6 py-3 text-sm whitespace-nowrap">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-600">
                    {event.direction === 'outbound' ? <HiArrowUpTray className="w-4 h-4" /> : <HiArrowDownTray className="w-4 h-4" />}
                  </span>
                </td>
                <td className="px-6 py-3 whitespace-nowrap">
                  <ProviderBadge provider={event.provider} />
                </td>
                <td className="px-6 py-3 text-sm text-slate-700 whitespace-nowrap font-mono">
                  {event.eventType}
                </td>
                <td className="px-6 py-3 whitespace-nowrap">
                  <StatusBadge status={event.status} />
                </td>
                <td className="px-6 py-3 text-sm text-slate-600 max-w-xs truncate">
                  {event.message || '—'}
                </td>
                <td className="px-6 py-3 whitespace-nowrap">
                  {event.payload && (
                    <button
                      onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                      className="text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-lg px-2 py-1 text-xs font-semibold transition-colors"
                    >
                      {selectedEvent?.id === event.id ? 'Hide' : 'View'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expanded payload view */}
      {selectedEvent && selectedEvent.payload && (
        <div className="border-t border-slate-200/70 bg-slate-50/70 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Payload Details</h3>
            <button
              onClick={() => setSelectedEvent(null)}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm"
            >
              <HiXMark className="w-4 h-4" /> Close
            </button>
          </div>
          <pre className="bg-white rounded-xl p-4 overflow-x-auto text-xs text-slate-700 border border-slate-200 max-h-96">
            {JSON.stringify(selectedEvent.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
