'use client'

import { useState } from 'react'
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  BarChart, 
  History, 
  Settings, 
  Plug,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard, id: 'dashboard' },
  { name: 'Users', icon: Users, id: 'users' },
  { name: 'Passports', icon: FileText, id: 'passports' },
  { name: 'Reports', icon: BarChart3, id: 'reports' },
  { name: 'Audit Logs', icon: History, id: 'audit' },
  { name: 'Integrations', icon: Plug, id: 'integrations' },
  { name: 'Settings', icon: Settings, id: 'settings' },
]

export default function DashboardLayout({ user, currentPage, onPageChange, onLogout, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-700'
      case 'admin':
        return 'bg-blue-100 text-blue-700'
      case 'manager':
        return 'bg-green-100 text-green-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getRoleLabel = (role) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin'
      case 'admin':
        return 'Admin'
      case 'manager':
        return 'Manager'
      default:
        return role
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-white/20 dark:border-slate-700/50 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 transform transition-all duration-300 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 transform hover:scale-105 transition-transform duration-200">
                <span className="text-white text-lg font-bold">RM</span>
              </div>
              <div>
                <h1 className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  Rareminds
                </h1>
                <p className="text-xs text-muted-foreground">Control Panel</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = currentPage === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onPageChange(item.id)
                    setSidebarOpen(false)
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-300 transform hover:scale-[1.02]",
                    isActive
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25 scale-[1.02]"
                      : "text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                  {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                </button>
              )
            })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-white/20 dark:border-slate-700/50">
            <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.email}</p>
                  <span className={cn(
                    "inline-block text-xs px-3 py-1 rounded-full font-medium shadow-sm",
                    getRoleBadgeColor(user.role)
                  )}>
                    {getRoleLabel(user.role)}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800/50 transition-all duration-300"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/20 dark:border-slate-700/50 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden hover:bg-white/50 dark:hover:bg-slate-800/50"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-xl font-semibold capitalize bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  {currentPage}
                </h2>
                <p className="text-sm text-muted-foreground">Manage your platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
