'use client'

import EntityCard from '../EntityCard'

export default function CardView({ entities, entityType, onViewDetails, onApprove, onReject }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {entities.map(entity => (
        <EntityCard
          key={entity.id}
          entity={entity}
          entityType={entityType}
          onViewDetails={onViewDetails}
          onApprove={onApprove}
          onReject={onReject}
        />
      ))}
    </div>
  )
}
