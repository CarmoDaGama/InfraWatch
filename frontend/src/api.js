import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

// Attach the JWT on every request, reading fresh from localStorage each time
// so the interceptor never holds a stale closure over a React state value.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear the stored token and notify App.jsx via a custom event.
// Using an event keeps this module decoupled from the React component tree.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.dispatchEvent(new Event('auth:logout'))
    }
    return Promise.reject(error)
  }
)

export const login = (credentials) => api.post('/auth/login', credentials)

export const getDevices   = ()     => api.get('/devices')
export const createDevice = (data) => api.post('/devices', { name: data.name, url: data.url })
export const deleteDevice = (id)   => api.delete(`/devices/${id}`)
export const getMetrics    = (params)      => api.get('/metrics', { params })
export const getUptimeStats = (hours = 24) => api.get('/metrics/uptime', { params: { hours } })
