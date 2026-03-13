import { useState } from 'react'

const CRITICALITY_OPTIONS = ['low', 'medium', 'high', 'critical']

const CRITICALITY_STYLE = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-yellow-100 text-yellow-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const CRITICALITY_LABEL = {
  low:      'Baixa',
  medium:   'Média',
  high:     'Alta',
  critical: 'Crítica',
}

function CriticalityBadge({ value }) {
  const style = CRITICALITY_STYLE[value] ?? 'bg-gray-100 text-gray-600'
  const label = CRITICALITY_LABEL[value] ?? value
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style}`}>
      {label}
    </span>
  )
}

function SlaStatusBadge({ sla_met }) {
  if (sla_met === null) {
    return <span className="text-xs text-gray-400">Sem dados</span>
  }
  return sla_met ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
      ✓ Cumprido
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">
      ✗ Violado
    </span>
  )
}

export default function SlaPanel({ uptimeStats, onUpdate }) {
  const [editing, setEditing]   = useState(null) // { id, sla_target, criticality }
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState(null)

  function startEdit(stat) {
    setSaveError(null)
    setEditing({
      id:          stat.id,
      sla_target:  String(stat.sla_target ?? 99.0),
      criticality: stat.criticality ?? 'medium',
    })
  }

  function cancelEdit() {
    setEditing(null)
    setSaveError(null)
  }

  async function handleSave() {
    const slaNum = parseFloat(editing.sla_target)
    if (isNaN(slaNum) || slaNum < 0 || slaNum > 100) {
      setSaveError('SLA deve ser um número entre 0 e 100.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await onUpdate(editing.id, { sla_target: slaNum, criticality: editing.criticality })
      setEditing(null)
    } catch (err) {
      setSaveError(err.response?.data?.error ?? err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!uptimeStats || uptimeStats.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Regras de SLA por Dispositivo</h2>
        <span className="text-xs text-gray-400">Uptime das últimas 24 h vs. target</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Dispositivo', 'Criticidade', 'Target SLA', 'Uptime Real', 'Estado', 'Ações'].map((h) => (
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
            {uptimeStats.map((stat) => {
              const isEditing = editing?.id === stat.id
              return (
                <tr
                  key={stat.id}
                  className={
                    stat.sla_met === false
                      ? 'bg-red-50 hover:bg-red-100'
                      : 'hover:bg-gray-50'
                  }
                >
                  {/* Device name */}
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {stat.name}
                  </td>

                  {/* Criticality — editable */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isEditing ? (
                      <select
                        value={editing.criticality}
                        onChange={(e) => setEditing((prev) => ({ ...prev, criticality: e.target.value }))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {CRITICALITY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{CRITICALITY_LABEL[opt]}</option>
                        ))}
                      </select>
                    ) : (
                      <CriticalityBadge value={stat.criticality} />
                    )}
                  </td>

                  {/* SLA Target — editable */}
                  <td className="px-6 py-4 text-sm whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={editing.sla_target}
                          onChange={(e) => setEditing((prev) => ({ ...prev, sla_target: e.target.value }))}
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-gray-500 text-xs">%</span>
                      </div>
                    ) : (
                      <span className="font-mono text-gray-700">{stat.sla_target ?? 99.0}%</span>
                    )}
                  </td>

                  {/* Actual uptime */}
                  <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap font-mono">
                    {stat.uptime_pct !== null ? `${stat.uptime_pct.toFixed(1)}%` : '—'}
                  </td>

                  {/* SLA status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <SlaStatusBadge sla_met={stat.sla_met} />
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex flex-col gap-1">
                        {saveError && (
                          <span className="text-xs text-red-600">{saveError}</span>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded px-3 py-1 text-xs font-medium transition-colors"
                          >
                            {saving ? 'A guardar…' : 'Guardar'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded px-2 py-1 text-xs font-medium transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(stat)}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded px-2 py-1 text-sm font-medium transition-colors"
                      >
                        Editar SLA
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
