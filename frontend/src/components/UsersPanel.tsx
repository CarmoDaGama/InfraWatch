import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getUsers, updateUserRole, createUser, deleteUser } from '../api'
import { HiTrash, HiPlus } from 'react-icons/hi2'

const ROLES = ['viewer', 'operator', 'admin']

export default function UsersPanel({ canUpdate = false, canCreate = false, canDelete = false }) {
  const { t } = useTranslation()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingUserId, setSavingUserId] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newUserData, setNewUserData] = useState({ email: '', password: '', role: 'viewer' })
  const [creatingUser, setCreatingUser] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState(null)

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await getUsers()
      setUsers(res.data)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  async function handleRoleChange(userId, nextRole) {
    if (!canUpdate) return

    setSavingUserId(userId)
    try {
      await updateUserRole(userId, nextRole)
      await fetchUsers()
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error ?? err.message)
    } finally {
      setSavingUserId(null)
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault()
    if (!newUserData.email.trim() || !newUserData.password.trim()) {
      setError(t('users.fillAllFields'))
      return
    }

    setCreatingUser(true)
    try {
      await createUser({
        email: newUserData.email.trim(),
        password: newUserData.password,
        role: newUserData.role,
      })
      setNewUserData({ email: '', password: '', role: 'viewer' })
      setShowCreateForm(false)
      await fetchUsers()
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error ?? err.message)
    } finally {
      setCreatingUser(false)
    }
  }

  async function handleDeleteUser(userId) {
    if (!window.confirm(t('users.deleteConfirm'))) {
      return
    }

    setDeletingUserId(userId)
    try {
      await deleteUser(userId)
      await fetchUsers()
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error ?? err.message)
    } finally {
      setDeletingUserId(null)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{t('users.title')}</h2>
        {canCreate && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <HiPlus className="w-4 h-4" />
            {t('users.createButton')}
          </button>
        )}
      </div>

      {showCreateForm && canCreate && (
        <form onSubmit={handleCreateUser} className="px-6 py-4 bg-blue-50 border-b border-blue-200">
          <div className="space-y-3">
            <input
              type="email"
              placeholder={t('users.emailPlaceholder')}
              value={newUserData.email}
              onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              disabled={creatingUser}
            />
            <input
              type="password"
              placeholder={t('users.passwordPlaceholder')}
              value={newUserData.password}
              onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              disabled={creatingUser}
            />
            <select
              value={newUserData.role}
              onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              disabled={creatingUser}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creatingUser}
                className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {creatingUser ? t('users.creating') : t('users.create')}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-3 py-2 bg-gray-300 text-gray-800 text-sm rounded-lg hover:bg-gray-400"
              >
                {t('users.cancel')}
              </button>
            </div>
          </div>
        </form>
      )}

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {t('users.email')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {t('users.role')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {t('users.createdAt')}
              </th>
              {canDelete && (
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('users.actions')}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={canDelete ? 4 : 3} className="px-6 py-8 text-center text-sm text-gray-400">
                  {t('users.loading')}
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={canDelete ? 4 : 3} className="px-6 py-8 text-center text-sm text-gray-400">
                  {t('users.empty')}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-800">{user.email}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">
                    {canUpdate ? (
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={savingUserId === user.id}
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="uppercase tracking-wide text-xs font-semibold">{user.role}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {user.created_at ? new Date(user.created_at).toLocaleString() : '—'}
                  </td>
                  {canDelete && (
                    <td className="px-6 py-3 text-sm">
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={deletingUserId === user.id}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50 p-2"
                        title={t('users.delete')}
                      >
                        <HiTrash className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
