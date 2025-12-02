'use client'

import { Button } from '@/components/ui/button'
import { LayoutGrid, Table2, List, Grid2X2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ApprovalViewSwitcher({ currentView, onViewChange }) {
  const views = [
    { id: 'card', icon: LayoutGrid, label: 'Card View' },
    { id: 'table', icon: Table2, label: 'Table View' },
    { id: 'list', icon: List, label: 'List View' },
    { id: 'compact', icon: Grid2X2, label: 'Compact Grid' }
  ]

  return (
    <div className="flex items-center gap-1 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 rounded-lg p-1">
      {views.map((view) => {
        const Icon = view.icon
        return (
          <Button
            key={view.id}
            variant="ghost"
            size="sm"
            onClick={() => onViewChange(view.id)}
            className={cn(
              'flex items-center gap-2',
              currentView === view.id && 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700'
            )}
            title={view.label}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{view.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
