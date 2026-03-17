import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createDevice } from '../api'

const INPUT_CLASS = 'w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

type FormErrors = {
  name?: string
  url?: string
  snmpPort?: string
  checkInterval?: string
  submit?: string
}

function resetForm() {
  return {
    name: '', url: '', type: 'http',
    snmpCommunity: 'public', snmpOid: '1.3.6.1.2.1.1.1.0',
    snmpPort: '161', checkIntervalSeconds: '60',
  }
}

export default function AddDeviceForm({ open, onClose, onAdd }) {
  const { t } = useTranslation()
  const [form, setForm]         = useState(resetForm())
  const [errors, setErrors]     = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  // Reset form each time modal opens
  useEffect(() => {
    if (open) {
      setForm(resetForm())
      setErrors({})
    }
  }, [open])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const { name, url, type, snmpCommunity, snmpOid, snmpPort, checkIntervalSeconds } = form

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const TYPE_OPTIONS = [
    { value: 'http', label: t('addDevice.typeHttp') },
    { value: 'ping', label: t('addDevice.typePing') },
    { value: 'snmp', label: t('addDevice.typeSnmp') },
  ]

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, type: e.target.value, url: '' }))
    setErrors({})
  }

  function validate() {
    const errs: FormErrors = {}
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

  async function handleSubmit(e: React.FormEvent) {
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
      onAdd()
      onClose()
    } catch (err) {
      const msg = (err as any).response?.data?.error || (err as any).response?.data?.message
      setErrors({ submit: msg || t('addDevice.error') })
    } finally {
      setSubmitting(false)
    }
  }

  const urlLabel       = type === 'http' ? t('addDevice.urlLabel')       : t('addDevice.hostLabel')
  const urlPlaceholder = type === 'http' ? t('addDevice.urlPlaceholder') : t('addDevice.hostPlaceholder')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-device-heading"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 id="add-device-heading" className="text-lg font-semibold text-gray-800">
            {t('addDevice.title')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-4">

          {/* Type */}
          <div>
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

          {/* Name */}
          <div>
            <label htmlFor="device-name" className="block text-sm font-medium text-gray-700 mb-1">
              {t('addDevice.name')}
            </label>
            <input
              id="device-name"
              type="text"
              placeholder={t('addDevice.namePlaceholder')}
              value={name}
              onChange={set('name')}
              className={`${INPUT_CLASS} ${errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              autoFocus
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* URL / Host */}
          <div>
            <label htmlFor="device-url" className="block text-sm font-medium text-gray-700 mb-1">
              {urlLabel}
            </label>
            <input
              id="device-url"
              type="text"
              placeholder={urlPlaceholder}
              value={url}
              onChange={set('url')}
              className={`${INPUT_CLASS} ${errors.url ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {errors.url && <p className="mt-1 text-xs text-red-600">{errors.url}</p>}
          </div>

          {/* SNMP Fields */}
          {type === 'snmp' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="snmp-community" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('addDevice.community')}
                  </label>
                  <input
                    id="snmp-community"
                    type="text"
                    value={snmpCommunity}
                    onChange={set('snmpCommunity')}
                    className={`${INPUT_CLASS} border-gray-300`}
                  />
                </div>
                <div>
                  <label htmlFor="snmp-port" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('addDevice.port')}
                  </label>
                  <input
                    id="snmp-port"
                    type="number"
                    min="1"
                    max="65535"
                    value={snmpPort}
                    onChange={set('snmpPort')}
                    className={`${INPUT_CLASS} ${errors.snmpPort ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  />
                  {errors.snmpPort && <p className="mt-1 text-xs text-red-600">{errors.snmpPort}</p>}
                </div>
              </div>
              <div>
                <label htmlFor="snmp-oid" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('addDevice.oid')}
                </label>
                <input
                  id="snmp-oid"
                  type="text"
                  value={snmpOid}
                  onChange={set('snmpOid')}
                  className={`${INPUT_CLASS} border-gray-300`}
                />
              </div>
            </>
          )}

          {/* Check Interval */}
          <div>
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
              onChange={set('checkIntervalSeconds')}
              className={`${INPUT_CLASS} ${errors.checkInterval ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {errors.checkInterval && <p className="mt-1 text-xs text-red-600">{errors.checkInterval}</p>}
          </div>

          {/* Submit error */}
          {errors.submit && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errors.submit}
            </p>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {t('sla.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold shadow transition-colors"
            >
              {submitting ? t('addDevice.adding') : t('addDevice.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

