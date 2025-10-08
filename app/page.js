'use client'

import { useState, useEffect } from 'react'
import LoginPage from '@/components/LoginPage'
import DashboardLayout from '@/components/DashboardLayout'
import Dashboard from '@/components/pages/Dashboard'
import UsersPage from '@/components/pages/UsersPage'
import PassportsPage from '@/components/pages/PassportsPage'
import ReportsPage from '@/components/pages/ReportsPage'
import AuditLogsPage from '@/components/pages/AuditLogsPage'
import IntegrationsPage from '@/components/pages/IntegrationsPage'
import SettingsPage from '@/components/pages/SettingsPage'
import { Toaster } from '@/components/ui/toaster'

function App() {
  const [user, setUser] = useState(null)
  const [currentPage, setCurrentPage] = useState('dashboard')

  useEffect(() => {
    // Check if user is logged in (in localStorage)
    const savedUser = localStorage.getItem('rareminds_user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        localStorage.removeItem('rareminds_user')
      }
    }
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    localStorage.setItem('rareminds_user', JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('rareminds_user')
    setCurrentPage('dashboard')
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard user={user} />
      case 'users':
        return <UsersPage currentUser={user} />
      case 'passports':
        return <PassportsPage currentUser={user} />
      case 'reports':
        return <ReportsPage />
      case 'audit':
        return <AuditLogsPage />
      case 'integrations':
        return <IntegrationsPage />
      case 'settings':
        return <SettingsPage user={user} />
      default:
        return <Dashboard user={user} />
    }
  }

  if (!user) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        <Toaster />
      </>
    )
  }

  return (
    <>
      <DashboardLayout
        user={user}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onLogout={handleLogout}
      >
        {renderPage()}
      </DashboardLayout>
      <Toaster />
    </>
  )
}

export default App