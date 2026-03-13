import { useState } from 'react'
import { createDevice } from '../api.js'

export default function AddDeviceForm({ onAdd }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function validate() {
    const errs = {}
    if (!name.trim()) errs.name = 'Device name is required.'
    if (!url.trim()) {
      errs.url = 'URL or IP is required.'
    } else if (
      !/^https?:\/\/.+/.test(url.trim()) &&
      !/^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)){3}$/.test(url.trim())
    ) {
      errs.url = 'Enter a valid URL (https://...) or IP address.'
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      await createDevice({ name: name.trim(), url: url.trim() })
      setName('')
      setUrl('')
      onAdd()
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || 'Failed to add device. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Add New Device</h2>
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="device-name" className="block text-sm font-medium text-gray-700 mb-1">
              Device Name
            </label>
            <input
              id="device-name"
              type="text"
              placeholder="e.g. Production API"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div className="flex-1">
            <label htmlFor="device-url" className="block text-sm font-medium text-gray-700 mb-1">
              URL or IP
            </label>
            <input
              id="device-url"
              type="text"
              placeholder="e.g. https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.url ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.url && <p className="mt-1 text-xs text-red-600">{errors.url}</p>}
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold shadow transition-colors"
            >
              {submitting ? 'Adding…' : 'Add Device'}
            </button>
          </div>
        </div>
        {errors.submit && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errors.submit}
          </p>
        )}
      </form>
    </div>
  )
}
