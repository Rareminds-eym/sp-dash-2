// Event markers stored in SkillPassport learners.metadata.events (a list of strings).
// An event only LABELS an educator; it never decides who appears on the Educator Subscriptions page.

export const EDUCATOR_EVENT_100K = '100k educators'

// Event value -> text shown to the user. Add a line here when a new event needs a label.
const EVENT_LABELS = {
  [EDUCATOR_EVENT_100K]: '100k Educators',
}

/**
 * The label to show for an educator's events, or null when there is nothing to show
 * (no events, or only events that have no label, such as some other event).
 */
export function getEventLabel(events) {
  if (!Array.isArray(events)) return null
  const known = events.find((event) => Object.hasOwn(EVENT_LABELS, event))
  return known === undefined ? null : EVENT_LABELS[known]
}
