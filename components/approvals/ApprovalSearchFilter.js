'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowDownAZ, Filter, Search } from 'lucide-react'
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
        {/* Sort Dropdown */}
        <Select value={sortValue} onValueChange={onSortChange}>
          <SelectTrigger className="w-[200px]">
            <ArrowDownAZ className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name (A-Z)</SelectItem>
            <SelectItem value="name-desc">Name (Z-A)</SelectItem>
            <SelectItem value="date-newest">Date (Newest First)</SelectItem>
            <SelectItem value="date-oldest">Date (Oldest First)</SelectItem>
            <SelectItem value="state-asc">State (A-Z)</SelectItem>
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
