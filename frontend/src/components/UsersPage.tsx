import UsersPanel from './UsersPanel'

export default function UsersPage({ canUpdate }) {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <UsersPanel canUpdate={canUpdate} />
    </main>
  )
}
