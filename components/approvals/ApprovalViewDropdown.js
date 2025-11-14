'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LayoutGrid, Table2, List, Grid2X2, ChevronDown } from 'lucide-react'
import { useApprovalView } from './ApprovalViewContext'
import { cn } from '@/lib/utils'

export default function ApprovalViewDropdown() {
  const { viewType, setViewType } = useApprovalView()

  const views = [
    { id: 'card', icon: LayoutGrid, label: 'Card View' },
    { id: 'table', icon: Table2, label: 'Table View' },
    { id: 'list', icon: List, label: 'List View' },
    { id: 'compact', icon: Grid2X2, label: 'Compact Grid' }
  ]

  const currentView = views.find(v => v.id === viewType) || views[0]
  const CurrentIcon = currentView.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 flex items-center justify-center bg-white dark:bg-slate-900"
          title={currentView.label}
        >
          <CurrentIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {views.map((view) => {
          const Icon = view.icon
          return (
            <DropdownMenuItem
              key={view.id}
              onClick={() => setViewType(view.id)}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                viewType === view.id && 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{view.label}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
