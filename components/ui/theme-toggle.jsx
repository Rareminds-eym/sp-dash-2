'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState, useRef } from 'react'
import { flushSync } from 'react-dom'
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
      // Set transition direction data attribute
      document.documentElement.setAttribute('data-theme-transition', toggled ? 'to-dark' : 'to-light')

      // Manually disable all transitions before theme change
      const css = document.createElement('style')
      css.appendChild(
        document.createTextNode(
          `* {
            -webkit-transition: none !important;
            -moz-transition: none !important;
            -o-transition: none !important;
            -ms-transition: none !important;
            transition: none !important;
          }`
        )
      )
      document.head.appendChild(css)

      // Set reveal origin + radius BEFORE startViewTransition so the first
      // animated frame already has the correct coordinates (setting them
      // after `transition.ready` starts the clip-path from the fallback
      // 50%/50% or stale coords, then jumps).
      const maxDistance = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )
      document.documentElement.style.setProperty('--x', `${x}px`)
      document.documentElement.style.setProperty('--y', `${y}px`)
      document.documentElement.style.setProperty('--r', `${maxDistance}px`)

      const transition = document.startViewTransition(() => {
        // Commit the theme synchronously inside the update callback so the
        // "new" snapshot captures the new theme. next-themes' setTheme alone
        // flows through React state (async), which can snapshot the old theme.
        flushSync(() => {
          setTheme(newTheme)
          setIsToggled(toggled)
        })
        document.documentElement.classList.toggle('dark', toggled)
        document.documentElement.style.colorScheme = newTheme
      })

      // Wait for the pseudo-element animations to be running before cleanup
      // wiring; coordinates are already set above.
      await transition.ready

      // Re-enable transitions after animation completes
      transition.finished.finally(() => {
        document.head.removeChild(css)
        document.documentElement.removeAttribute('data-theme-transition')
      })
    } else {
      // Fallback for browsers without View Transitions API
      setTheme(newTheme)
      setIsToggled(toggled)
    }
  }

  if (!mounted) {
    return (
      <div className="w-10 h-10 flex items-center justify-center">
        <div className="w-6 h-6" />
      </div>
    )
  }

  return (
    <div ref={buttonRef} className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-300">
      <Expand
        toggled={isToggled}
        toggle={handleThemeToggle}
        duration={1200}
        className="text-current hover:scale-110 transition-transform cursor-pointer"
        style={{ fontSize: '1.25rem' }}
      />
    </div>
  )
}