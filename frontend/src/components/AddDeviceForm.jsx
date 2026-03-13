import { useState } from 'react'
import { createDevice } from '../api.js'

const TYPE_OPTIONS = [
  { value: 'http', label: 'HTTP' },
  { value: 'ping', label: 'ICMP Ping' },
  { value: 'snmp', label: 'SNMPv2c' },
]

const INPUT_CLASS = 'w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function AddDeviceForm({ onAdd }) {
  const [name,          setName]          = useState('')
  const [url,           setUrl]           = useState('')
  const [type,          setType]          = useState('http')
  const [snmpCommunity, setSnmpCommunity] = useState('public')
  const [snmpOid,       setSnmpOid]       = useState('1.3.6.1.2.1.1.1.0')
  const [snmpPort,      setSnmpPort]      = useState('161')
  const [errors,        setErrors]        = useState({})
  const [submitting,    setSubmitting]    = useState(false)

  function validate() {
    const errs = {}
    if (!name.trim()) errs.name = 'Device name is required.'
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      errs.url = `${type === 'http' ? 'URL' : 'Host / IP'} is required.`
    } else if (type === 'http' && !/^https?:\/\/.+/.test(trimmedUrl)) {
      errs.url = 'Enter a valid URL starting with http:// or https://'
    }
    if (type === 'snmp') {
      const p = parseInt(snmpPort, 10)
      if (isNaN(p) || p < 1 || p > 65535) errs.snmpPort = 'Port must be 1–65535.'
    }
    return errs
  }

  function handleTypeChange(e) {
    setType(e.target.value)
    setUrl('')
    setErrors({})
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setSubmitting(true)
    try {
      await createDevice({
        name:           name.trim(),
        url:            url.trim(),
        type,
        snmp_community: snmpCommunity.trim() || 'public',
        snmp_oid:       snmpOid.trim()       || '1.3.6.1.2.1.1.1.0',
        snmp_port:      parseInt(snmpPort, 10) || 161,
      })
      setName(''); setUrl(''); setType('http')
      setSnmpCommunity('public'); setSnmpOid('1.3.6.1.2.1.1.1.0'); setSnmpPort('161')
      onAdd()
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message
      setErrors({ submit: msg || 'Failed to add device. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const urlLabel       = type === 'http' ? 'URL'               : 'Host / IP'
  const urlPlaceholder = type === 'http' ? 'https://example.com' : '192.168.1.1'

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Add New Device</h2>
      <form onSubmit={handleSubmit} noValidate>

        {/* Row 1: Type + Name + URL/Host */}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">

          {/* Type selector */}
          <div className="w-full sm:w-36">
            <label htmlFor="device-type" className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              id="device-type"
              value={type}
              onChange={handleTypeChange}
              className={`${INPUT_CLASS} border-gray-300`}
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <label htmlFor="device-name" className="block text-sm font-medium text-gray-700 mb-1">
              Device Name
            </label>
            <input
              id="device-name"
              type="text"
              placeholder="e.g. Production API"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${INPUT_CLASS} ${errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* URL or Host/IP */}
          <div className="flex-1 min-w-0">
            <label htmlFor="device-url" className="block text-sm font-medium text-gray-700 mb-1">
              {urlLabel}
            </label>
            <input
              id="device-url"
              type="text"
              placeholder={urlPlaceholder}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={`${INPUT_CLASS} ${errors.url ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {errors.url && <p className="mt-1 text-xs text-red-600">{errors.url}</p>}
          </div>
        </div>

        {/* Row 2: SNMP fields (only shown for snmp type) */}
        {type === 'snmp' && (
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="flex-1 min-w-0">
              <label htmlFor="snmp-community" className="block text-sm font-medium text-gray-700 mb-1">
                Community String
              </label>
              <input
                id="snmp-community"
                type="text"
                value={snmpCommunity}
                onChange={(e) => setSnmpCommunity(e.target.value)}
                className={`${INPUT_CLASS} border-gray-300`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <label htmlFor="snmp-oid" className="block text-sm font-medium text-gray-700 mb-1">
                OID
              </label>
              <input
                id="snmp-oid"
                type="text"
                value={snmpOid}
                onChange={(e) => setSnmpOid(e.target.value)}
                className={`${INPUT_CLASS} border-gray-300`}
              />
            </div>
            <div className="w-full sm:w-28">
              <label htmlFor="snmp-port" className="block text-sm font-medium text-gray-700 mb-1">
                Port
              </label>
              <input
                id="snmp-port"
                type="number"
                min="1"
                max="65535"
                value={snmpPort}
                onChange={(e) => setSnmpPort(e.target.value)}
                className={`${INPUT_CLASS} ${errors.snmpPort ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {errors.snmpPort && <p className="mt-1 text-xs text-red-600">{errors.snmpPort}</p>}
            </div>
          </div>
        )}

        {/* Submit row */}
        <div className="mt-4 flex items-center gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold shadow transition-colors"
          >
            {submitting ? 'Adding…' : 'Add Device'}
          </button>
          {errors.submit && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errors.submit}
            </p>
          )}
        </div>

      </form>
    </div>
  )
}
