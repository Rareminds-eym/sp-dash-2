'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasToken, setHasToken] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if there's a password reset token in the URL hash
    const checkForToken = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const type = hashParams.get('type')
      
      if (accessToken && type === 'recovery') {
        setHasToken(true)
      } else {
        // No valid token, redirect to login
        setError('Invalid or expired password reset link. Please request a new one.')
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      }
    }

    checkForToken()
  }, [router])

  const validatePassword = (pwd) => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long'
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter'
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter'
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password strength
    const validationError = validatePassword(password)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    try {
      // Create Supabase client
      const supabase = createClient()

      // Update the user's password
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) {
        console.error('Error updating password:', updateError)
        setError(updateError.message || 'Failed to update password')
        setLoading(false)
        return
      }

      if (data?.user) {
        // Password updated successfully
        setSuccess(true)

        // Call the verify-and-activate endpoint to activate the admin account
        try {
          const response = await fetch('/api/users/verify-and-activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              userId: data.user.id,
              email: data.user.email 
            })
          })

          const activationData = await response.json()
          
          if (!response.ok) {
            console.error('Activation error:', activationData)
            // Don't fail the password reset if activation fails
            // User can still login, but admin might need to manually activate
          }
        } catch (activationError) {
          console.error('Error calling activation endpoint:', activationError)
          // Continue anyway - password is set
        }

        // Wait a moment then redirect to dashboard (user is now logged in)
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 2000)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  if (!hasToken && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">Verifying your password reset link...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300 animate-in fade-in duration-300">
      <Card className="w-full max-w-md mx-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-white/20 dark:border-slate-700/50 shadow-2xl shadow-slate-200/50 dark:shadow-slate-900/50">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/25 transform hover:scale-105 transition-transform duration-300">
              <Lock className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
            Set Your Password
          </CardTitle>
          <CardDescription className="text-lg text-slate-600 dark:text-slate-400">
            Create a strong password for your admin account
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Password Set Successfully!
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Your account has been activated. Redirecting to dashboard...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="password" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  New Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-300 h-12 text-base"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={8}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Must be at least 8 characters with uppercase, lowercase, and number
                </p>
              </div>
              <div className="space-y-3">
                <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-300 h-12 text-base"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
              {error && (
                <div className="flex items-center gap-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-200 dark:border-red-800/50 animate-in fade-in slide-in-from-top-2 duration-300">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300"
                disabled={loading}
              >
                {loading ? 'Setting Password...' : 'Set Password & Activate Account'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
