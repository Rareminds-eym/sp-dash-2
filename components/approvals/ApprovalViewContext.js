'use client'

import { createContext, useContext, useState, useEffect } from 'react'

const ApprovalViewContext = createContext()

export function ApprovalViewProvider({ children }) {
  // Always start with 'card' to match SSR
  const [viewType, setViewType] = useState('card')
  const [isHydrated, setIsHydrated] = useState(false)

  // Load from localStorage after hydration
  useEffect(() => {
    const savedView = localStorage.getItem('approvalViewType')
    if (savedView) {
      setViewType(savedView)
    }
    setIsHydrated(true)
  }, [])

  // Save to localStorage when viewType changes
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('approvalViewType', viewType)
    }
  }, [viewType, isHydrated])

  return (
    <ApprovalViewContext.Provider value={{ viewType, setViewType, isHydrated }}>
      {children}
    </ApprovalViewContext.Provider>
  )
}

export function useApprovalView() {
  const context = useContext(ApprovalViewContext)
  if (!context) {
    throw new Error('useApprovalView must be used within ApprovalViewProvider')
  }
  return context
}
