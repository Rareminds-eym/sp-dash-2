import { Badge } from '@/components/ui/badge'
import { getEventLabel } from '@/lib/educator-events'

// Small badge shown next to an educator's name when they came from a labelled event
// (for example "100k Educators"). Renders nothing when there is no label to show.
export function EducatorEventBadge({ events }) {
  const label = getEventLabel(events)
  if (!label) return null

  return (
    <Badge className="whitespace-nowrap border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
      {label}
    </Badge>
  )
}
