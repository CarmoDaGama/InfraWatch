import { useEffect, useState, useCallback } from 'react'
import Header from './components/Header.jsx'
import DeviceTable from './components/DeviceTable.jsx'
import AddDeviceForm from './components/AddDeviceForm.jsx'
import UptimeChart from './components/UptimeChart.jsx'
import SlaPanel from './components/SlaPanel.jsx'
import LoginPage from './components/LoginPage.jsx'
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
  // Lazy initialiser reads localStorage once on mount — no flicker on refresh.
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [devices, setDevices] = useState([])
  const [uptimeStats, setUptimeStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function handleLogin(newToken) {
    localStorage.setItem('token', newToken)
    setToken(newToken)
  }

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setDevices([])
    setUptimeStats([])
    setLoading(true)
    setError(null)
  }, [])

  // Listen for 401 auto-logout events fired by the axios response interceptor.
  useEffect(() => {
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [handleLogout])

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
      setError(null)
    } catch (err) {
      if (err.response?.status === 401) return // interceptor already fired auth:logout
      setError(
        err.code === 'ERR_NETWORK'
          ? 'Cannot reach the InfraWatch API. Make sure the backend is running on port 3001.'
          : `API error: ${err.message}`
      )
    } finally {
      setLoading(false)
    }
  }, [token])

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
      setError(`Failed to delete device: ${err.message}`)
    }
  }

  async function handleUpdateDevice(id, data) {
    await updateDevice(id, data)
    await fetchData()
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  const upCount = devices.filter((d) => d.status === 'up').length
  const downCount = devices.filter((d) => d.status === 'down').length

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onLogout={handleLogout} />

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
              <span className="text-sm">Loading devices…</span>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Total Devices" value={devices.length} color="text-gray-800" />
              <StatCard label="Up" value={upCount} color="text-green-600" />
              <StatCard label="Down" value={downCount} color="text-red-600" />
            </div>

            <AddDeviceForm onAdd={fetchData} />

            <DeviceTable devices={devices} onDelete={handleDelete} loading={loading} />

            <UptimeChart uptimeStats={uptimeStats} />

            <SlaPanel uptimeStats={uptimeStats} onUpdate={handleUpdateDevice} />
          </>
        )}
      </main>
    </div>
  )
}
