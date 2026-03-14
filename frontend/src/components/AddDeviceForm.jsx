import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createDevice } from '../api.js'

const INPUT_CLASS = 'w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function AddDeviceForm({ onAdd }) {
  const { t } = useTranslation()
  const [name,          setName]          = useState('')
  const [url,           setUrl]           = useState('')
  const [type,          setType]          = useState('http')
  const [snmpCommunity, setSnmpCommunity] = useState('public')
  const [snmpOid,       setSnmpOid]       = useState('1.3.6.1.2.1.1.1.0')
  const [snmpPort,      setSnmpPort]      = useState('161')
  const [checkIntervalSeconds, setCheckIntervalSeconds] = useState('60')
  const [errors,        setErrors]        = useState({})
  const [submitting,    setSubmitting]    = useState(false)

  const TYPE_OPTIONS = [
    { value: 'http', label: t('addDevice.typeHttp') },
    { value: 'ping', label: t('addDevice.typePing') },
    { value: 'snmp', label: t('addDevice.typeSnmp') },
  ]

  function validate() {
    const errs = {}
    if (!name.trim()) errs.name = t('addDevice.nameRequired')
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      errs.url = type === 'http' ? t('addDevice.urlRequired') : t('addDevice.hostRequired')
    } else if (type === 'http' && !/^https?:\/\/.+/.test(trimmedUrl)) {
      errs.url = t('addDevice.urlInvalid')
    }
    if (type === 'snmp') {
      const p = parseInt(snmpPort, 10)
      if (isNaN(p) || p < 1 || p > 65535) errs.snmpPort = t('addDevice.portInvalid')
    }
    const intervalNum = Number(checkIntervalSeconds)
    if (!Number.isInteger(intervalNum) || intervalNum < 5 || intervalNum > 3600) {
      errs.checkInterval = t('addDevice.intervalInvalid')
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
        check_interval_seconds: parseInt(checkIntervalSeconds, 10) || 60,
      })
      setName(''); setUrl(''); setType('http')
      setSnmpCommunity('public'); setSnmpOid('1.3.6.1.2.1.1.1.0'); setSnmpPort('161'); setCheckIntervalSeconds('60')
      onAdd()
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message
      setErrors({ submit: msg || t('addDevice.error') })
    } finally {
      setSubmitting(false)
    }
  }

  const urlLabel       = type === 'http' ? t('addDevice.urlLabel')       : t('addDevice.hostLabel')
  const urlPlaceholder = type === 'http' ? t('addDevice.urlPlaceholder') : t('addDevice.hostPlaceholder')

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('addDevice.title')}</h2>
      <form onSubmit={handleSubmit} noValidate>

        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          <div className="w-full sm:w-36">
            <label htmlFor="device-type" className="block text-sm font-medium text-gray-700 mb-1">
              {t('addDevice.type')}
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

          <div className="flex-1 min-w-0">
            <label htmlFor="device-name" className="block text-sm font-medium text-gray-700 mb-1">
              {t('addDevice.name')}
            </label>
            <input
              id="device-name"
              type="text"
              placeholder={t('addDevice.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${INPUT_CLASS} ${errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

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

        {type === 'snmp' && (
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="flex-1 min-w-0">
              <label htmlFor="snmp-community" className="block text-sm font-medium text-gray-700 mb-1">
                {t('addDevice.community')}
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
                {t('addDevice.oid')}
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
                {t('addDevice.port')}
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

        <div className="w-full sm:w-56 mt-4">
          <label htmlFor="check-interval" className="block text-sm font-medium text-gray-700 mb-1">
            {t('addDevice.interval')}
          </label>
          <input
            id="check-interval"
            type="number"
            min="5"
            max="3600"
            step="1"
            value={checkIntervalSeconds}
            onChange={(e) => setCheckIntervalSeconds(e.target.value)}
            className={`${INPUT_CLASS} ${errors.checkInterval ? 
'border-red-400 bg-red-50' : 'border-gray-300'}`} />
          {errors.checkInterval && <p className="mt-1 text-xs text-red-600">{errors.checkInterval}</p>}
        </div>
        <div className="mt-4 flex items-center gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold shadow transition-colors"
          >
            {submitting ? t('addDevice.adding') : t('addDevice.add')}
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
