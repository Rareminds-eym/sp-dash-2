'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { AlertCircle } from 'lucide-react'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      if (data.success) {
        onLogin(data.user)
      }
    } catch (err) {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300">
      <Card className="w-full max-w-md mx-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-white/20 dark:border-slate-700/50 shadow-2xl shadow-slate-200/50 dark:shadow-slate-900/50">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/25 transform hover:scale-105 transition-transform duration-300">
              <span className="text-white text-2xl font-bold">RM</span>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
            Rareminds Control
          </CardTitle>
          <CardDescription className="text-lg text-slate-600 dark:text-slate-400">
            Super Admin Dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@rareminds.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-300 h-12 text-base"
                required
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-300 h-12 text-base"
                required
              />
            </div>
            {error && (
              <div className="flex items-center gap-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-200 dark:border-red-800/50">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button 
              type="submit" 
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 transform hover:scale-[1.02]" 
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <div className="mt-8 p-4 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-700/50">
            <p className="font-semibold text-center text-slate-700 dark:text-slate-300 mb-3">Test Credentials:</p>
            <div className="space-y-1 text-sm text-center text-slate-600 dark:text-slate-400">
              <p>Super Admin: <code className="bg-white/50 dark:bg-slate-700/50 px-2 py-1 rounded">superadmin@rareminds.com</code></p>
              <p>Admin: <code className="bg-white/50 dark:bg-slate-700/50 px-2 py-1 rounded">admin@rareminds.com</code></p>
              <p>Manager: <code className="bg-white/50 dark:bg-slate-700/50 px-2 py-1 rounded">manager@rareminds.com</code></p>
            </div>
            <p className="mt-3 text-xs text-center text-slate-500 dark:text-slate-500">(Any password works for demo)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
