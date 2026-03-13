import { useState } from 'react'
import { login } from '../api.js'

export default function LoginPage({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors]     = useState({})
  const [submitting, setSubmitting] = useState(false)

  function validate() {
    const errs = {}
    if (!email.trim())    errs.email    = 'Email is required.'
    if (!password)        errs.password = 'Password is required.'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      const res = await login({ email: email.trim(), password })
      onLogin(res.data.token)
    } catch (err) {
      setErrors({
        submit: err.response?.data?.error || 'Invalid credentials. Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm">

        <div className="mb-6 text-center">
          <span className="text-3xl animate-pulse">🔴</span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 mt-2">InfraWatch</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.email ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.password ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password}</p>
            )}
          </div>

          {errors.submit && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errors.submit}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold shadow transition-colors"
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

        </form>
      </div>
    </div>
  )
}
