export default function Header({ onLogout }) {
  return (
    <header className="bg-gray-900 text-white py-6 px-6 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-pulse">🔴</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">InfraWatch</h1>
            <p className="text-gray-400 text-sm mt-0.5">Real-time Infrastructure Monitoring</p>
          </div>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium text-gray-200 transition-colors"
          >
            Sign Out
          </button>
        )}
      </div>
    </header>
  )
}

