import { useTranslation } from 'react-i18next'

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
    <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLang(code)}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
            current === code
              ? 'bg-blue-600 text-white shadow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function Header({ onLogout }) {
  const { t } = useTranslation()
  return (
    <header className="bg-gray-900 text-white py-6 px-6 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-pulse">🔴</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('header.title')}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{t('header.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LangSwitcher />
          {onLogout && (
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium text-gray-200 transition-colors"
            >
              {t('header.signOut')}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
