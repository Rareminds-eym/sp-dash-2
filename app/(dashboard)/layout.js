'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  BarChart3,
  Brain,
  Briefcase,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MoreVertical,
  Plug,
  RefreshCw,
  School,
  Settings,
  Shield,
  Trophy,
  Users,
  X
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ApprovalViewProvider } from '@/components/approvals/ApprovalViewContext'

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { name: 'Admin Management', icon: Shield, href: '/users' },
  { name: 'Verification Center', icon: FileText, href: '/passports' },
  {
    name: 'Approval Center',
    icon: CheckCircle,
    href: '/approvals',
    subItems: [
      { name: 'Universities', href: '/approvals?tab=universities', icon: Building2 },
      { name: 'Recruiters', href: '/approvals?tab=recruiters', icon: Briefcase },
      { name: 'Colleges', href: '/approvals?tab=colleges', icon: School },
      { name: 'Students', href: '/approvals?tab=students', icon: Users },
    ]
  },
  {
    name: 'Reports & Analytics',
    icon: BarChart3,
    href: '/reports',
    subItems: [
      { name: 'Universities', href: '/reports?tab=universities', icon: Building2 },
      { name: 'Recruiters', href: '/reports?tab=recruiters', icon: Briefcase },
      { name: 'Placements', href: '/reports?tab=placements', icon: Trophy },
      { name: 'Heatmap', href: '/reports?tab=heatmap', icon: MapPin },
      { name: 'Insights', href: '/reports?tab=insights', icon: Brain },
    ]
  },
  { name: 'Audit Logs', icon: History, href: '/audit-logs' },
  { name: 'Integrations', icon: Plug, href: '/integrations' },
  { name: 'Settings', icon: Settings, href: '/settings' },
]

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    }
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    }
  }
}

const itemVariants = {
  hidden: {
    x: -20,
    opacity: 0,
    scale: 0.95
  },
  visible: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  },
  exit: {
    x: -20,
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2
    }
  }
}

const subNavVariants = {
  hidden: {
    x: 300,
    opacity: 0
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  },
  exit: {
    x: 300,
    opacity: 0,
    transition: {
      duration: 0.3
    }
  }
}

const backButtonVariants = {
  hidden: {
    x: -50,
    opacity: 0,
    scale: 0.8
  },
  visible: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
      delay: 0.1
    }
  },
  hover: {
    scale: 1.05,
    x: -5,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 10
    }
  },
  tap: {
    scale: 0.95
  }
}

const titleDividerVariants = {
  hidden: {
    scaleX: 0,
    opacity: 0
  },
  visible: {
    scaleX: 1,
    opacity: 1,
    transition: {
      duration: 0.5,
      delay: 0.2,
      ease: "easeOut"
    }
  }
}

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedNav, setExpandedNav] = useState(null) // null = main nav, or parent nav item
  const [isDesktop, setIsDesktop] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Get current URL with search params for active state detection
  const [currentUrl, setCurrentUrl] = useState('')

  useEffect(() => {
    // Update currentUrl whenever pathname changes or component mounts
    const updateUrl = () => {
      if (typeof window !== 'undefined') {
        setCurrentUrl(window.location.pathname + window.location.search)
      }
    }

    updateUrl()

    // Listen for popstate events (browser back/forward)
    window.addEventListener('popstate', updateUrl)

    // Also check on every route change
    // const intervalId = setInterval(updateUrl, 100)

    return () => {
      window.removeEventListener('popstate', updateUrl)
      // clearInterval(intervalId)
    }
  }, [pathname, searchParams])

  // Check if desktop on mount and window resize
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024) // lg breakpoint
    }

    checkDesktop()
    window.addEventListener('resize', checkDesktop)

    return () => window.removeEventListener('resize', checkDesktop)
  }, [])

  // Auto-expand navigation when on a sub-page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      const hasTab = searchParams.has('tab')

      if (hasTab) {
        // Find the parent nav item that has this path
        const parentItem = navigation.find(item =>
          item.subItems && pathname.startsWith(item.href)
        )
        if (parentItem && expandedNav?.href !== parentItem.href) {
          setExpandedNav(parentItem)
        }
      }
    }
  }, [pathname, currentUrl])

  useEffect(() => {
    // Fetch current user session
    fetch('/api/auth/session')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        if (data.success && data.user) {
          setUser(data.user)
        }
      })
      .catch(err => {
        console.error('Failed to fetch session:', err)
        // If session fetch fails, user might not be authenticated
        // Don't redirect here, let middleware handle it
      })
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    // Trigger a page refresh by dispatching a custom event
    window.dispatchEvent(new CustomEvent('refreshPage'))
    // Reset refreshing state after a delay
    setTimeout(() => setRefreshing(false), 1000)
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        // Clear any local state
        setUser(null)

        // Force a full page reload to clear all cached state
        window.location.href = '/login'
      } else {
        console.error('Logout failed:', data.error)
        // Even if server-side logout fails, redirect to login
        window.location.href = '/login'
      }
    } catch (err) {
      console.error('Logout error:', err)
      // On error, still redirect to login page
      window.location.href = '/login'
    }
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      case 'admin':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      case 'manager':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
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

  const getPageTitle = () => {
    const currentNav = navigation.find(nav => nav.href === pathname)
    return currentNav ? currentNav.name : 'Dashboard'
  }

  const handleExport = () => {
    // Dispatch custom event for the page to handle export with its filters
    window.dispatchEvent(new CustomEvent('exportData'))
  }

  const canShowMenu = () => {
    return pathname === '/passports'
  }

  return (
    <ApprovalViewProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300">
        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{
            x: isDesktop ? 0 : (sidebarOpen ? 0 : -256),
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30
          }}
          className="fixed top-0 left-0 z-50 h-full w-64 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-white/20 dark:border-slate-700/50 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50"
        >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-slate-700/50">
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <motion.div
                  className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25"
                  whileHover={{
                    scale: 1.1,
                    rotate: [0, -10, 10, -10, 0],
                    transition: { duration: 0.5 }
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.span
                    className="text-white text-lg font-bold"
                    animate={{
                      scale: [1, 1.05, 1],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 2,
                      ease: "easeInOut"
                    }}
                  >
                    RM
                  </motion.span>
                </motion.div>
                <div>
                  <motion.h1
                    className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    Rareminds
                  </motion.h1>
                  <motion.p
                    className="text-xs text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    Control Panel
                  </motion.p>
                </div>
              </motion.div>
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
            <nav className="flex-1 p-4 overflow-y-auto overflow-x-hidden">
              <AnimatePresence mode="wait">
                {expandedNav === null ? (
                  // Main Navigation
                  <motion.div
                    key="main-nav"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-1"
                  >
                    {navigation.map((item, index) => {
                      const Icon = item.icon
                      const isActive = pathname === item.href || (item.subItems && pathname.startsWith(item.href))
                      const hasSubItems = item.subItems && item.subItems.length > 0

                      return (
                        <motion.div key={item.href} variants={itemVariants}>
                          {hasSubItems ? (
                            <motion.button
                              onClick={() => setExpandedNav(item)}
                              whileHover={{ scale: 1.02, x: 5 }}
                              whileTap={{ scale: 0.98 }}
                              className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-300",
                                isActive
                                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                                  : "text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50"
                              )}
                            >
                              <motion.div
                                animate={isActive ? { rotate: [0, -10, 10, -10, 0] } : {}}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                              >
                                <Icon className="h-5 w-5" />
                              </motion.div>
                              {item.name}
                              <motion.div
                                className="ml-auto"
                                animate={{ x: [0, 5, 0] }}
                                transition={{ repeat: Infinity, duration: 1.5, delay: index * 0.2 }}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </motion.div>
                            </motion.button>
                          ) : (
                            <Link href={item.href} onClick={() => setSidebarOpen(false)}>
                              <motion.div
                                whileHover={{ scale: 1.02, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-300",
                                  isActive
                                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                                    : "text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50"
                                )}
                              >
                                <motion.div
                                  animate={isActive ? { rotate: [0, -10, 10, -10, 0] } : {}}
                                  transition={{ duration: 0.5, delay: index * 0.1 }}
                                >
                                  <Icon className="h-5 w-5" />
                                </motion.div>
                                {item.name}
                                {isActive && (
                                  <motion.div
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    className="ml-auto"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </motion.div>
                                )}
                              </motion.div>
                            </Link>
                          )}
                        </motion.div>
                      )
                    })}
                  </motion.div>
                ) : (
                  // Sub-Navigation
                  <motion.div
                    key="sub-nav"
                    variants={subNavVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-1"
                  >
                    {/* Back Button */}
                    <motion.button
                      variants={backButtonVariants}
                      initial="hidden"
                      animate="visible"
                      whileHover="hover"
                      whileTap="tap"
                      onClick={() => setExpandedNav(null)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all duration-300 mb-4"
                    >
                      <motion.div
                        animate={{ x: [-3, 0, -3] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </motion.div>
                      Back
                    </motion.button>

                    {/* Parent Item Title */}
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="px-4 py-2 mb-2"
                    >
                      <div className="flex items-center gap-3 text-sm font-semibold text-gray-900 dark:text-white">
                        {(() => {
                          const Icon = expandedNav.icon
                          return (
                            <motion.div
                              animate={{ rotate: [0, 360] }}
                              transition={{ duration: 0.6, delay: 0.3 }}
                            >
                              <Icon className="h-5 w-5" />
                            </motion.div>
                          )
                        })()}
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          {expandedNav.name}
                        </motion.span>
                      </div>
                      <motion.div
                        variants={titleDividerVariants}
                        initial="hidden"
                        animate="visible"
                        className="h-px bg-gradient-to-r from-blue-500 to-purple-600 mt-2 origin-left"
                      />
                    </motion.div>

                    {/* Sub Items */}
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      className="space-y-1"
                    >
                      {expandedNav.subItems.map((subItem, index) => {
                        const SubIcon = subItem.icon

                        // Robust active state detection
                        let isActive = false
                        try {
                          // Create URL objects for comparison (using dummy base)
                          const current = new URL(currentUrl, 'http://localhost')
                          const target = new URL(subItem.href, 'http://localhost')

                          // Check if paths match
                          if (current.pathname === target.pathname) {
                            const currentTab = current.searchParams.get('tab')
                            const targetTab = target.searchParams.get('tab')

                            if (currentTab === targetTab) {
                              isActive = true
                            } else if (!currentTab && targetTab === 'universities') {
                              // Default to universities tab if no tab specified
                              isActive = true
                            }
                          }
                        } catch (e) {
                          // Fallback to simple inclusion check
                          isActive = currentUrl === subItem.href ||
                            (currentUrl && subItem.href && currentUrl.includes(subItem.href))
                        }

                        return (
                          <motion.div key={subItem.href} variants={itemVariants}>
                            <Link href={subItem.href} onClick={() => setSidebarOpen(false)}>
                              <motion.div
                                whileHover={{ scale: 1.02, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-300",
                                  isActive
                                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                                    : "text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50"
                                )}
                              >
                                <motion.div
                                  animate={isActive ? {
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 10, -10, 0]
                                  } : {}}
                                  transition={{ duration: 0.5, delay: index * 0.1 }}
                                >
                                  <SubIcon className="h-5 w-5" />
                                </motion.div>
                                {subItem.name}
                                {isActive && (
                                  <motion.div
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                    className="ml-auto"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </motion.div>
                                )}
                              </motion.div>
                            </Link>
                          </motion.div>
                        )
                      })}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </nav>

            {/* User info */}
            {user && (
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
                  className="w-full text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800/50 hover:text-red-700 dark:hover:text-red-300 transition-all duration-300"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </motion.aside>

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
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  {getPageTitle()}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="w-10 h-10 rounded-md flex items-center justify-center"
                      >
                        <RefreshCw className={cn("h-5 w-5 transition-transform duration-300 hover:scale-110", refreshing && "animate-spin")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Refresh</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <ThemeToggle />
                {canShowMenu() && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-10 h-10 rounded-md flex items-center justify-center hover:scale-110 transition-all duration-300 hover:bg-white/50 dark:hover:bg-slate-800/50"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" />
                        Export to CSV
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </ApprovalViewProvider>
  )
}