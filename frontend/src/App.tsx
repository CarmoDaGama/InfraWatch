import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import DashboardPage from './components/DashboardPage'
import DevicesPage from './components/DevicesPage'
import IntegrationsPage from './components/IntegrationsPage'
import UsersPage from './components/UsersPage'
import LoginPage from './components/LoginPage'
import { getDevices, updateDevice, getUptimeStats } from './api'

const REFRESH_INTERVAL = 5000

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
  const [activeRoute, setActiveRoute] = useState('dashboard')

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
    setActiveRoute('dashboard')
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

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <Sidebar activeRoute={activeRoute} onNavigate={setActiveRoute} role={authUser?.role} />

      {/* Main content */}
      <div className="main-shell">
        <Header onLogout={handleLogout} role={authUser?.role} />

        {/* Page content */}
        <div className="content-scroll relative">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-24 h-64 w-64 rounded-full bg-cyan-200/30 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-teal-200/25 blur-3xl" />
          </div>

          <div className="relative z-10">
          {error && (
            <div className="px-4 sm:px-6 lg:px-8 pt-5">
              <div className="glass-card border-red-200/70 bg-red-50/85 px-5 py-4 flex items-start gap-3">
                <span className="text-red-500 mt-0.5">⚠️</span>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {loading && devices.length === 0 ? (
            <div className="flex justify-center items-center h-96 px-4">
              <div className="glass-card px-8 py-7 flex flex-col items-center gap-3 text-slate-500">
                <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-semibold">{t('app.loading')}</span>
              </div>
            </div>
          ) : (
            <>
              {activeRoute === 'dashboard' && (
                <DashboardPage
                  devices={devices}
                  uptimeStats={uptimeStats}
                  onUpdate={handleUpdateDevice}
                  canUpdate={canUpdateDevices}
                />
              )}

              {activeRoute === 'devices' && (
                <DevicesPage
                  devices={devices}
                  loading={loading}
                  onRefresh={fetchData}
                  canCreate={canCreateDevices}
                  canDelete={canDeleteDevices}
                  canUpdate={canUpdateDevices}
                  authUser={authUser}
                />
              )}

              {activeRoute === 'integrations' && <IntegrationsPage />}

              {activeRoute === 'users' && canReadUsers && (
                <UsersPage canUpdate={canUpdateUsers} />
              )}
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
