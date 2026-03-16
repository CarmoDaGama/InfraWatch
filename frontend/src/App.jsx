import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Header from './components/Header.jsx'
import DeviceTable from './components/DeviceTable.jsx'
import AddDeviceForm from './components/AddDeviceForm.jsx'
import UptimeChart from './components/UptimeChart.jsx'
import SlaPanel from './components/SlaPanel.jsx'
import MetricsDrawer from './components/MetricsDrawer.jsx'
import LoginPage from './components/LoginPage.jsx'
import UsersPanel from './components/UsersPanel.jsx'
import { getDevices, deleteDevice, updateDevice, getUptimeStats } from './api.js'

const REFRESH_INTERVAL = 5000

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl shadow px-6 py-4 flex flex-col items-center">
      <span className={`text-3xl font-bold ${color}`}>{value}</span>
      <span className="text-sm text-gray-500 mt-1">{label}</span>
    </div>
  )
}

export default function App() {
  const { t } = useTranslation()
  // Lazy initialiser reads localStorage once on mount — no flicker on refresh.
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [authUser, setAuthUser] = useState(() => {
    const raw = localStorage.getItem('auth-user')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })
  const [devices, setDevices] = useState([])
  const [uptimeStats, setUptimeStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDevice, setSelectedDevice] = useState(null)

  function handleLogin(auth) {
    const newToken = auth?.token
    const newUser = auth?.user ?? null
    if (!newToken) return

    localStorage.setItem('token', newToken)
    if (newUser) {
      localStorage.setItem('auth-user', JSON.stringify(newUser))
    } else {
      localStorage.removeItem('auth-user')
    }

    setToken(newToken)
    setAuthUser(newUser)
  }

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('auth-user')
    setToken(null)
    setAuthUser(null)
    setDevices([])
    setUptimeStats([])
    setSelectedDevice(null)
    setLoading(true)
    setError(null)
  }, [])

  // Listen for 401 auto-logout events fired by the axios response interceptor.
  useEffect(() => {
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [handleLogout])

  const can = useCallback((permission) => {
    const permissions = authUser?.permissions
    if (!Array.isArray(permissions)) return false
    return permissions.includes('*') || permissions.includes(permission)
  }, [authUser])

  const canCreateDevices = can('devices:create')
  const canUpdateDevices = can('devices:update')
  const canDeleteDevices = can('devices:delete')
  const canReadUsers = can('users:read')
  const canUpdateUsers = can('users:update')

  const fetchData = useCallback(async () => {
    if (!token) return
    try {
      const [devicesRes, uptimeRes] = await Promise.all([
        getDevices(),
        getUptimeStats(24),
      ])
      const mapped = devicesRes.data.map((d) => ({
        ...d,
        status: d.last_status ?? null,
        lastChecked: d.last_checked ?? null,
        responseTime: d.last_response_time ?? null,
      }))
      setDevices(mapped)
      setUptimeStats(uptimeRes.data)
      // Keep the open detail view in sync with the refreshed device data
      setSelectedDevice((prev) => {
        if (!prev) return null
        return mapped.find((d) => d.id === prev.id) ?? prev
      })
      setError(null)
    } catch (err) {
      if (err.response?.status === 401) return // interceptor already fired auth:logout
      setError(
        err.code === 'ERR_NETWORK'
          ? t('app.networkError')
          : err.response?.status === 403
            ? t('app.forbidden')
          : t('app.apiError', { message: err.message })
      )
    } finally {
      setLoading(false)
    }
  }, [token, t])

  useEffect(() => {
    if (!token) return
    fetchData()
    const timer = setInterval(fetchData, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [fetchData, token])

  async function handleDelete(id) {
    try {
      await deleteDevice(id)
      await fetchData()
    } catch (err) {
      setError(
        err.response?.status === 403
          ? t('app.forbidden')
          : t('app.deleteError', { message: err.message })
      )
    }
  }

  async function handleUpdateDevice(id, data) {
    try {
      await updateDevice(id, data)
      await fetchData()
    } catch (err) {
      setError(
        err.response?.status === 403
          ? t('app.forbidden')
          : t('app.apiError', { message: err.message })
      )
    }
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  const upCount = devices.filter((d) => d.status === 'up').length
  const downCount = devices.filter((d) => d.status === 'down').length

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onLogout={handleLogout} role={authUser?.role} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
            <span className="text-red-500 mt-0.5">⚠️</span>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {loading && devices.length === 0 ? (
          <div className="flex justify-center items-center py-24">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">{t('app.loading')}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <StatCard label={t('app.totalDevices')} value={devices.length} color="text-gray-800" />
              <StatCard label={t('app.up')} value={upCount} color="text-green-600" />
              <StatCard label={t('app.down')} value={downCount} color="text-red-600" />
            </div>

            {canCreateDevices && <AddDeviceForm onAdd={fetchData} />}

            <DeviceTable
              devices={devices}
              onDelete={handleDelete}
              onViewHistory={setSelectedDevice}
              loading={loading}
              canDelete={canDeleteDevices}
            />

            <UptimeChart uptimeStats={uptimeStats} />

            <SlaPanel uptimeStats={uptimeStats} onUpdate={handleUpdateDevice} canEdit={canUpdateDevices} />

            {canReadUsers && <UsersPanel canUpdate={canUpdateUsers} />}
          </>
        )}
      </main>

      {selectedDevice && (
        <MetricsDrawer
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onUpdate={handleUpdateDevice}
          canEdit={canUpdateDevices}
        />
      )}
    </div>
  )
}
