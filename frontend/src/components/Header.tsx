import { useTranslation } from 'react-i18next'
import { HiSignal } from 'react-icons/hi2'

const LANGS = [
  { code: 'pt', label: 'PT' },
  { code: 'en', label: 'EN' },
]

function LangSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.language

  function switchLang(code) {
    i18n.changeLanguage(code)
    localStorage.setItem('infrawatch-lang', code)
  }

  return (
    <div className="flex items-center gap-1 rounded-xl bg-slate-900/80 p-1 border border-slate-700/70">
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLang(code)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all ${
            current === code
              ? 'bg-teal-500 text-slate-900 shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function Header({ onLogout, role }) {
  const { t } = useTranslation()
  return (
    <header className="px-4 sm:px-6 lg:px-8 pt-4">
      <div className="glass-card rounded-2xl px-5 py-4 flex items-center justify-between border-slate-100/80">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
            <HiSignal className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">{t('header.title')}</h1>
            <p className="text-slate-600 text-xs sm:text-sm mt-0.5">{t('header.subtitle')}</p>
            {role && (
              <p className="text-slate-500 text-xs mt-0.5">
                {t('header.role')}: <span className="font-bold uppercase tracking-wide text-slate-700">{role}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LangSwitcher />
          {onLogout && (
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors shadow"
            >
              {t('header.signOut')}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
