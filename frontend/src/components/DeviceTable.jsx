import StatusBadge from './StatusBadge.jsx'

const TYPE_BADGE = {
  http: 'bg-blue-100 text-blue-700',
  ping: 'bg-purple-100 text-purple-700',
  snmp: 'bg-orange-100 text-orange-700',
}
const TYPE_LABEL = { http: 'HTTP', ping: 'Ping', snmp: 'SNMP' }

function TypeBadge({ type }) {
  const cls   = TYPE_BADGE[type] ?? 'bg-gray-100 text-gray-600'
  const label = TYPE_LABEL[type] ?? (type ?? '—')
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function formatLastChecked(timestamp) {
  if (!timestamp) return '—'
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return new Date(timestamp).toLocaleTimeString()
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(8)].map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  )
}

export default function DeviceTable({ devices, onDelete, onViewHistory, loading }) {
  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800">Monitored Devices</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Name', 'Type', 'Host / URL', 'Status', 'Response Time', 'Interval', 'Last Checked', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && devices.length === 0 ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-400 text-sm">
                  No devices monitored yet.
                </td>
              </tr>
            ) : (
              devices.map((device) => (
                <tr
                  key={device.id}
                  className={device.status === 'down' ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {device.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <TypeBadge type={device.type} />
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap">
                    {(!device.type || device.type === 'http') ? (
                      <a
                        href={device.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {device.url}
                      </a>
                    ) : (
                      <span className="text-gray-700">{device.url}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={device.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                    {device.responseTime != null ? `${device.responseTime} ms` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                    {Number.isInteger(device.check_interval_seconds) ? `${device.check_interval_seconds}s` : '60s'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                    {formatLastChecked(device.lastChecked)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onViewHistory(device)}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded px-2 py-1 text-sm font-medium transition-colors"
                        title="Ver histórico de métricas"
                      >
                        Histórico
                      </button>
                      <button
                        onClick={() => onDelete(device.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded px-2 py-1 text-sm font-medium transition-colors"
                        title="Delete device"
                      >
                        ✕ Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
