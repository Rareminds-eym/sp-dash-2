'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState, useRef } from 'react'
import { Expand } from '@theme-toggles/react'
import '@theme-toggles/react/css/Expand.css'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isToggled, setIsToggled] = useState(false)
  const buttonRef = useRef(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Update toggle state when theme changes
    setIsToggled(theme === 'dark')
  }, [theme])

  const handleThemeToggle = async (toggled) => {
    const newTheme = toggled ? 'dark' : 'light'
    
    // Get button position for circular animation origin
    const rect = buttonRef.current?.getBoundingClientRect()
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2

    // Check if View Transitions API is supported
    if (document.startViewTransition) {
      const transition = document.startViewTransition(() => {
        setTheme(newTheme)
        setIsToggled(toggled)
      })
      
      // Apply circular reveal animation
      await transition.ready
      
      // Calculate the maximum distance from click point to corners
      const maxDistance = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )
      
      // Add custom animation
      document.documentElement.style.setProperty('--x', `${x}px`)
      document.documentElement.style.setProperty('--y', `${y}px`)
      document.documentElement.style.setProperty('--r', `${maxDistance}px`)
    } else {
      // Fallback for browsers without View Transitions API
      setTheme(newTheme)
      setIsToggled(toggled)
    }
  }

  if (!mounted) {
    return (
      <div className="w-9 h-9 flex items-center justify-center">
        <div className="w-6 h-6" />
      </div>
    )
  }

  return (
    <div ref={buttonRef} className="flex items-center justify-center">
      <Expand
        toggled={isToggled}
        toggle={handleThemeToggle}
        duration={750}
        className="text-current hover:scale-110 transition-transform cursor-pointer"
        style={{ fontSize: '1.5rem' }}
      />
    </div>
  )
}