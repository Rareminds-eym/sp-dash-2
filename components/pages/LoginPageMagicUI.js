'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { BorderBeam } from '@/components/magicui/border-beam'
import TextShimmer from '@/components/magicui/text-shimmer'
import ShimmerButton from '@/components/magicui/shimmer-button'
import Particles from '@/components/magicui/particles'
import { motion } from 'framer-motion'

export default function LoginPageMagicUI() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

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
          // Wait a bit for cookies to be set, then force a full page reload
          // This ensures middleware properly validates the session
          await new Promise(resolve => setTimeout(resolve, 100))
          window.location.href = '/dashboard'
        }
      } catch (err) {
        setError('Network error. Please try again.')
      }
    })
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated Background Particles */}
      <Particles
        className="absolute inset-0 z-0"
        quantity={150}
        ease={80}
        color="#ffffff"
        refresh={false}
      />

      {/* Animated Gradient Beams Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-pink-500/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Animated Grid Lines */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#4f4f4f15_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10"
      >
        <Card className="relative w-full max-w-md mx-4 bg-white/10 dark:bg-slate-900/50 backdrop-blur-2xl border-white/20 dark:border-slate-700/50 shadow-2xl overflow-hidden">
          {/* Animated Border Beam */}
          <BorderBeam 
            size={300}
            duration={12}
            delay={0}
            borderWidth={2}
            colorFrom="#60a5fa"
            colorTo="#a855f7"
          />

          <CardHeader className="space-y-1 text-center relative z-10">
            {/* Animated Logo */}
            <motion.div 
              className="flex justify-center mb-6"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            >
              <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-purple-500/50 transform hover:scale-110 transition-all duration-300 hover:rotate-12">
                <span className="text-white text-2xl font-bold">RM</span>
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent rounded-3xl"></div>
              </div>
            </motion.div>

            {/* Shimmer Text Title */}
            <CardTitle className="text-3xl font-bold">
              <TextShimmer 
                className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
                shimmerWidth={200}
                duration={3}
                as="h1"
              >
                Rareminds Control
              </TextShimmer>
            </CardTitle>

            <CardDescription className="text-lg text-slate-300 dark:text-slate-400">
              Super Admin Dashboard
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8 relative z-10">
            <form onSubmit={handleSubmit} className="space-y-6">
              <motion.div 
                className="space-y-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Label htmlFor="email" className="text-sm font-semibold text-slate-200 dark:text-slate-300">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@rareminds.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/10 dark:bg-slate-800/50 backdrop-blur-sm border-white/30 dark:border-slate-700/50 focus:border-blue-400 dark:focus:border-blue-400 transition-all duration-300 h-12 text-base text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/50"
                  required
                  disabled={isPending}
                  autoComplete="email"
                />
              </motion.div>

              <motion.div 
                className="space-y-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <Label htmlFor="password" className="text-sm font-semibold text-slate-200 dark:text-slate-300">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/10 dark:bg-slate-800/50 backdrop-blur-sm border-white/30 dark:border-slate-700/50 focus:border-blue-400 dark:focus:border-blue-400 transition-all duration-300 h-12 text-base text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/50"
                  required
                  disabled={isPending}
                  autoComplete="current-password"
                />
              </motion.div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 text-sm text-red-300 bg-red-500/20 p-4 rounded-2xl border border-red-500/30 backdrop-blur-sm"
                >
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                {isPending ? (
                  <Button 
                    type="button"
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/25 relative overflow-hidden"
                    disabled
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Particles
                        className="absolute inset-0"
                        quantity={30}
                        ease={80}
                        color="#ffffff"
                        refresh={false}
                        staticity={30}
                      />
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin relative z-10"></div>
                      <span className="relative z-10">Signing in...</span>
                    </div>
                  </Button>
                ) : (
                  <ShimmerButton
                    type="submit"
                    className="w-full h-12 font-semibold text-base"
                    shimmerColor="#ffffff"
                    shimmerSize="0.1em"
                    borderRadius="1rem"
                    shimmerDuration="2s"
                    background="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                  >
                    Sign in
                  </ShimmerButton>
                )}
              </motion.div>
            </form>

            <motion.div 
              className="mt-8 p-4 bg-white/5 dark:bg-slate-800/20 backdrop-blur-sm rounded-2xl border border-white/10 dark:border-slate-700/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <p className="font-semibold text-center text-slate-200 dark:text-slate-300 mb-3">
                Test Credentials:
              </p>
              <div className="space-y-1 text-sm text-center text-slate-300 dark:text-slate-400">
                <p>
                  Super Admin:{' '}
                  <code className="bg-white/10 dark:bg-slate-700/50 px-2 py-1 rounded font-mono text-xs text-blue-300">
                    superadmin@rareminds.in
                  </code>
                </p>
                <p>
                  Admin:{' '}
                  <code className="bg-white/10 dark:bg-slate-700/50 px-2 py-1 rounded font-mono text-xs text-blue-300">
                    admin@rareminds.in
                  </code>
                </p>
                <p>
                  Manager:{' '}
                  <code className="bg-white/10 dark:bg-slate-700/50 px-2 py-1 rounded font-mono text-xs text-blue-300">
                    manager@rareminds.in
                  </code>
                </p>
              </div>
              <p className="mt-3 text-xs text-center text-slate-400 dark:text-slate-500">
                Password:{' '}
                <code className="bg-white/10 dark:bg-slate-700/50 px-2 py-1 rounded font-mono text-purple-300">
                  password123
                </code>
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
