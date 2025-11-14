'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowDownAZ, ArrowDownZA, ArrowDown10, ArrowUp10, MapPin, Filter, Search } from 'lucide-react'
import ApprovalViewDropdown from './ApprovalViewDropdown'

export default function ApprovalSearchFilter({
  searchValue,
  onSearchChange,
  filters,
  onFilterChange,
  sortValue,
  onSortChange,
  uniqueStates = [],
  uniqueColleges = [],
  uniqueBranches = [],
  entityType,
  placeholder = 'Search...',
  showViewSwitcher = false
}) {
  const handleClearFilters = () => {
    const clearedFilters = {
      state: 'all'
    }
    
    if (entityType === 'student') {
      clearedFilters.college = 'all'
      clearedFilters.branch = 'all'
    }
    
    onFilterChange(clearedFilters)
  }

  // Map sort values to icons
  const getSortIcon = (value) => {
    switch(value) {
      case 'name-asc':
        return <ArrowDownAZ className="h-4 w-4" />
      case 'name-desc':
        return <ArrowDownZA className="h-4 w-4" />
      case 'date-newest':
        return <ArrowDown10 className="h-4 w-4" />
      case 'date-oldest':
        return <ArrowUp10 className="h-4 w-4" />
      case 'state-asc':
        return <MapPin className="h-4 w-4" />
      default:
        return <ArrowDownAZ className="h-4 w-4" />
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-white dark:bg-slate-900"
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {/* Sort Dropdown - Icon Only */}
        <Select value={sortValue} onValueChange={onSortChange}>
          <SelectTrigger className="w-[50px] px-2">
            {getSortIcon(sortValue)}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">
              <div className="flex items-center gap-2">
                <ArrowDownAZ className="h-4 w-4" />
                <span>Name (A-Z)</span>
              </div>
            </SelectItem>
            <SelectItem value="name-desc">
              <div className="flex items-center gap-2">
                <ArrowDownZA className="h-4 w-4" />
                <span>Name (Z-A)</span>
              </div>
            </SelectItem>
            <SelectItem value="date-newest">
              <div className="flex items-center gap-2">
                <ArrowDown10 className="h-4 w-4" />
                <span>Date (Newest First)</span>
              </div>
            </SelectItem>
            <SelectItem value="date-oldest">
              <div className="flex items-center gap-2">
                <ArrowUp10 className="h-4 w-4" />
                <span>Date (Oldest First)</span>
              </div>
            </SelectItem>
            <SelectItem value="state-asc">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>State (A-Z)</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.state} onValueChange={(value) => onFilterChange({...filters, state: value})}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {uniqueStates.map(state => (
              <SelectItem key={state} value={state}>{state}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {entityType === 'student' && (
          <>
            <Select value={filters.college || 'all'} onValueChange={(value) => onFilterChange({...filters, college: value})}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Colleges" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Colleges</SelectItem>
                {uniqueColleges.map(college => (
                  <SelectItem key={college} value={college}>{college}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.branch || 'all'} onValueChange={(value) => onFilterChange({...filters, branch: value})}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {uniqueBranches.map(branch => (
                  <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        
        <Button 
          variant="outline" 
          onClick={handleClearFilters}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Clear Filters
        </Button>
        {showViewSwitcher && <ApprovalViewDropdown />}
      </div>
    </div>
  )
}
