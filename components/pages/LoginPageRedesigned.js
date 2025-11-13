'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Mail, Lock, ArrowRight, KeyRound, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BorderBeam } from '@/components/magicui/border-beam'
import { GridPattern } from '@/components/magicui/grid-pattern'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function LoginPageRedesigned() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState('')
  const [isSendingReset, setIsSendingReset] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Login failed')
          return
        }

        if (data.success) {
          await new Promise(resolve => setTimeout(resolve, 100))
          window.location.href = '/dashboard'
        }
      } catch (err) {
        setError('Network error. Please try again.')
      }
    })
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setForgotError('')
    setForgotSuccess('')

    if (!forgotEmail) {
      setForgotError('Please enter your email address')
      return
    }

    setIsSendingReset(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      })

      const data = await response.json()

      if (!response.ok) {
        setForgotError(data.error || 'Failed to send reset email')
        setIsSendingReset(false)
        return
      }

      setForgotSuccess(data.message)
      setForgotEmail('')
      
      // Close dialog after 3 seconds
      setTimeout(() => {
        setShowForgotPassword(false)
        setForgotSuccess('')
      }, 3000)

    } catch (err) {
      setForgotError('Network error. Please try again.')
    } finally {
      setIsSendingReset(false)
    }
  }

  const handleOpenForgotPassword = () => {
    setShowForgotPassword(true)
    setForgotEmail(email) // Pre-fill with login email if available
    setForgotError('')
    setForgotSuccess('')
  }

  const handleCloseForgotPassword = () => {
    setShowForgotPassword(false)
    setForgotEmail('')
    setForgotError('')
    setForgotSuccess('')
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Grid Pattern Background */}
      <GridPattern
        width={60}
        height={60}
        x={-1}
        y={-1}
        strokeDasharray="0"
        className={"[mask-image:radial-gradient(700px_circle_at_center,white,transparent)] stroke-muted-foreground/30 fill-muted-foreground/5 dark:stroke-muted-foreground/20 dark:fill-muted-foreground/10"}
      />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md px-4"
      >
        <Card className="relative overflow-hidden border-2 bg-card/95 backdrop-blur-xl shadow-2xl">
          {/* Animated Border */}
          <BorderBeam
            size={250}
            duration={12}
            delay={0}
            borderWidth={2}
            colorFrom="#1D8AD1"
            colorTo="#5378F1"
          />

          <CardHeader className="space-y-4 text-center pb-6">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex justify-center"
            >
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-white">RM</span>
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <CardTitle className="text-2xl font-bold tracking-tight">
                Welcome Back
              </CardTitle>
              <CardDescription className="mt-2">
                Sign in to access Rareminds Control Panel
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="space-y-6 pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="space-y-2"
              >
                <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@rareminds.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                  required
                  disabled={isPending}
                  autoComplete="email"
                />
              </motion.div>

              {/* Password Field */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={handleOpenForgotPassword}
                    className="text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                  required
                  disabled={isPending}
                  autoComplete="current-password"
                />
              </motion.div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-start gap-3 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              >
                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity relative group"
                  disabled={isPending}
                >
                  {isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </Button>
              </motion.div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          className="mt-6 text-center text-sm text-muted-foreground"
        >
          © 2024 Rareminds. All rights reserved.
        </motion.p>
      </motion.div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Reset Password</DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  Enter your email to receive a password reset link
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-sm font-medium">
                Email Address
              </Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="admin@rareminds.in"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="h-11"
                required
                disabled={isSendingReset}
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Success Message */}
            <AnimatePresence>
              {forgotSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-start gap-3 p-3 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg"
                >
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{forgotSuccess}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            <AnimatePresence>
              {forgotError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-start gap-3 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{forgotError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseForgotPassword}
                className="flex-1"
                disabled={isSendingReset}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-primary to-secondary"
                disabled={isSendingReset}
              >
                {isSendingReset ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Sending...</span>
                  </div>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
