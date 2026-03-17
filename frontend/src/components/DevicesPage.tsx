import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DeviceTable from './DeviceTable'
import AddDeviceForm from './AddDeviceForm'
import MetricsDrawer from './MetricsDrawer'
import { deleteDevice, updateDevice } from '../api'

export default function DevicesPage({ devices, loading, onRefresh, canCreate, canDelete, canUpdate, authUser }) {
  const { t } = useTranslation()
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState(null)

  const handleDelete = useCallback(
    async (id) => {
      try {
        await deleteDevice(id)
        await onRefresh()
      } catch (err) {
        setError(
          err.response?.status === 403
            ? t('app.forbidden')
            : t('app.deleteError', { message: err.message })
        )
      }
    },
    [onRefresh, t]
  )

  const handleUpdateDevice = useCallback(
    async (id, data) => {
      try {
        await updateDevice(id, data)
        await onRefresh()
      } catch (err) {
        setError(
          err.response?.status === 403
            ? t('app.forbidden')
            : t('app.apiError', { message: err.message })
        )
      }
    },
    [onRefresh, t]
  )

  return (
    <main className="page-frame">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <span className="text-red-500 mt-0.5">⚠️</span>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Header row with Add Device button */}
      <div className="glass-card px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="section-title">{t('deviceTable.title')}</h1>
          <p className="section-subtitle">Manage endpoints, intervals and check history.</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl shadow transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            {t('addDevice.add')}
          </button>
        )}
      </div>

      <DeviceTable
        devices={devices}
        onDelete={handleDelete}
        onViewHistory={setSelectedDevice}
        loading={loading}
        canDelete={canDelete}
      />

      {/* Add Device Modal */}
      <AddDeviceForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={async () => { await onRefresh() }}
      />

      {selectedDevice && (
        <MetricsDrawer
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onUpdate={handleUpdateDevice}
          canEdit={canUpdate}
        />
      )}
    </main>
  )
}
