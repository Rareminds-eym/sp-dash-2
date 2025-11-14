'use client'

import { createContext, useContext, useState, useEffect } from 'react'

const ApprovalViewContext = createContext()

export function ApprovalViewProvider({ children }) {
  const [viewType, setViewType] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('approvalViewType') || 'card'
    }
    return 'card'
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('approvalViewType', viewType)
    }
  }, [viewType])

  return (
    <ApprovalViewContext.Provider value={{ viewType, setViewType }}>
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
