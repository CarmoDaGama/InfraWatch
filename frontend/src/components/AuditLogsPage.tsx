import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAuditLogs } from '../api'
import { HiMagnifyingGlass } from 'react-icons/hi2'

const ACTION_TYPES = [
  'user.login',
  'user.login_failed',
  'user.created',
  'user.deleted',
  'user.role_changed',
  'device.created',
  'device.updated',
  'device.deleted',
]

export default function AuditLogsPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [action, setAction] = useState('')
  const [total, setTotal] = useState(0)

  async function fetchLogs() {
    setLoading(true)
    try {
      const params = {
        limit,
        offset,
        ...(action ? { action } : {}),
      }
      const res = await getAuditLogs(params)
      setLogs(res.data.items)
      setTotal(res.data.total)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [offset, action])

  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)

  function formatTimestamp(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('pt-PT')
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">{t('audit.title')}</h1>
        <p className="text-sm text-gray-600 mt-1">{t('audit.subtitle')}</p>
      </div>

      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('audit.filterAction')}</label>
        <div className="flex items-center gap-3">
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value)
              setOffset(0)
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('audit.allActions')}</option>
            {ACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('audit.timestamp')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('audit.userEmail')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('audit.action')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('audit.target')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('audit.detail')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('audit.ip')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                  {t('audit.loading')}
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                  {t('audit.empty')}
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-800 whitespace-nowrap">
                    {formatTimestamp(log.created_at)}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-800">{log.email || '—'}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{log.target || '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 max-w-xs truncate" title={log.detail}>
                    {log.detail || '—'}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{log.ip || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {t('audit.pagination', { start: Math.min(offset + 1, total), end: Math.min(offset + limit, total), total })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
          >
            {t('audit.previous')}
          </button>
          <span className="text-sm text-gray-600">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
          >
            {t('audit.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
