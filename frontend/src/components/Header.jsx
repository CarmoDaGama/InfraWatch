export default function Header() {
  return (
    <header className="bg-gray-900 text-white py-6 px-6 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <span className="text-2xl animate-pulse">🔴</span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">InfraWatch</h1>
          <p className="text-gray-400 text-sm mt-0.5">Real-time Infrastructure Monitoring</p>
        </div>
      </div>
    </header>
  )
}
