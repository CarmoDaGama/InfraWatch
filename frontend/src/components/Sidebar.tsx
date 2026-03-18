import { useTranslation } from 'react-i18next'
import { HiChartBar, HiCpuChip, HiLink, HiUsers, HiSignal, HiClipboardDocumentList } from 'react-icons/hi2'

const ROUTES = [
  { id: 'dashboard', icon: HiChartBar, label: 'sidebar.dashboard' },
  { id: 'devices', icon: HiCpuChip, label: 'sidebar.devices' },
  { id: 'integrations', icon: HiLink, label: 'sidebar.integrations' },
  { id: 'users', icon: HiUsers, label: 'sidebar.users', adminOnly: true },
  { id: 'audit', icon: HiClipboardDocumentList, label: 'sidebar.audit', adminOnly: true },
]

export default function Sidebar({ activeRoute, onNavigate, role }) {
  const { t } = useTranslation()
  const isAdmin = role === 'admin'

  return (
    <aside className="w-20 sm:w-72 p-2 sm:p-4 sm:pr-3 h-screen">
      <div className="h-full rounded-3xl border border-slate-700/40 bg-gradient-to-b from-slate-900 via-slate-900 to-teal-950 text-white shadow-2xl flex flex-col overflow-hidden">
      <div className="p-3 sm:p-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-white/10 text-teal-300 flex items-center justify-center">
            <HiSignal className="w-6 h-6" />
          </span>
          <div className="hidden sm:block">
            <h1 className="text-lg font-extrabold tracking-tight">{t('header.title')}</h1>
            <p className="text-xs text-slate-300 mt-0.5">{t('header.subtitle')}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2">
        {ROUTES.filter((route) => !route.adminOnly || isAdmin).map((route) => {
          const Icon = route.icon
          return (
            <button
              key={route.id}
              onClick={() => onNavigate(route.id)}
              className={`w-full flex items-center justify-center sm:justify-start gap-3 px-2 sm:px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeRoute === route.id
                  ? 'bg-white/16 text-white ring-1 ring-white/30 shadow'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </span>
              <span className="hidden sm:inline">{t(route.label)}</span>
            </button>
          )
        })}
      </nav>

      <div className="hidden sm:block p-4 border-t border-slate-700/50">
        <div className="text-xs text-slate-300 mb-3">
          <p className="font-semibold uppercase tracking-wide">{t('header.role')}</p>
          <p className="mt-1 text-white capitalize font-bold">{role}</p>
        </div>
      </div>
      </div>
    </aside>
  )
}
