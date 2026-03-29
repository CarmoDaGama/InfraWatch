import { useEffect, useState } from 'react'
import { getIntegrationConfig, updateIntegrationConfig } from '../api'

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

function ProviderCard({
  title,
  provider,
  values,
  onChange,
}: {
  title: string
  provider: 'glpi' | 'docuware'
  values: any
  onChange: (provider: 'glpi' | 'docuware', field: string, value: any) => void
}) {
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(values?.enabled)}
            onChange={(e) => onChange(provider, 'enabled', e.target.checked)}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Enabled
        </label>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Webhook URL</label>
        <input
          className={INPUT_CLASS}
          value={values?.webhook_url ?? ''}
          onChange={(e) => onChange(provider, 'webhook_url', e.target.value)}
          placeholder="https://your-webhook-endpoint"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Webhook Token</label>
        <input
          type="password"
          className={INPUT_CLASS}
          value={values?.webhook_token ?? ''}
          onChange={(e) => onChange(provider, 'webhook_token', e.target.value)}
          placeholder="Bearer token (optional)"
        />
      </div>
    </div>
  )
}

export default function IntegrationConfigPanel() {
  const [form, setForm] = useState<any>({
    glpi: { enabled: false, webhook_url: '', webhook_token: '' },
    docuware: { enabled: false, webhook_url: '', webhook_token: '' },
    inbound_webhook_secret: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function loadConfig() {
    setLoading(true)
    try {
      const res = await getIntegrationConfig()
      setForm(res.data)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  function updateProvider(provider: 'glpi' | 'docuware', field: string, value: any) {
    setForm((prev: any) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      },
    }))
  }

  async function handleSave() {
    setSaving(true)
    setSuccess(null)
    try {
      await updateIntegrationConfig(form)
      setSuccess('Integration settings saved.')
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="glass-card p-5 text-sm text-slate-500">Loading integration settings...</div>
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-6">
        <h2 className="section-title">Integration Settings</h2>
        <p className="section-subtitle mt-1">Configure outbound webhooks and inbound secret from the UI.</p>
      </div>

      {error && <div className="glass-card p-4 border-red-200 bg-red-50/80 text-sm text-red-700">{error}</div>}
      {success && <div className="glass-card p-4 border-emerald-200 bg-emerald-50/80 text-sm text-emerald-700">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProviderCard title="GLPI" provider="glpi" values={form.glpi} onChange={updateProvider} />
        <ProviderCard title="DocuWare" provider="docuware" values={form.docuware} onChange={updateProvider} />
      </div>

      <div className="glass-card p-5 space-y-3">
        <h3 className="text-base font-bold text-slate-800">Inbound Webhook Security</h3>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">X-Integration-Secret</label>
          <input
            type="password"
            className={INPUT_CLASS}
            value={form.inbound_webhook_secret ?? ''}
            onChange={(e) => setForm((prev: any) => ({ ...prev, inbound_webhook_secret: e.target.value }))}
            placeholder="Shared secret for /api/integrations/webhook/:provider"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white text-sm font-semibold shadow"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
