import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

export const getDevices = () => api.get('/devices')
export const createDevice = (data) => api.post('/devices', { name: data.name, url: data.url })
export const deleteDevice = (id) => api.delete(`/devices/${id}`)
export const getMetrics = (params) => api.get('/metrics', { params })
export const getUptimeStats = (hours = 24) => api.get('/metrics/uptime', { params: { hours } })
