// Combined class sessions: one session row per class, all sharing combined_group_id.
// The admin list shows the rows of one combined class as a single event; single-class sessions are unchanged.

/** One entry per teaching event: a single session, or all sibling rows of a combined class session. */
export function groupSessionsForDisplay(sessions) {
  const events = [];
  const byGroup = new Map();
  for (const s of sessions) {
    if (!s.combined_group_id) {
      events.push({ key: s.id, groupId: null, sessions: [s], representative: s });
      continue;
    }
    let event = byGroup.get(s.combined_group_id);
    if (!event) {
      event = { key: `group:${s.combined_group_id}`, groupId: s.combined_group_id, sessions: [], representative: s };
      byGroup.set(s.combined_group_id, event);
      events.push(event);
    }
    event.sessions.push(s);
  }
  for (const event of events) {
    if (!event.groupId) continue;
    event.sessions.sort((a, b) => String(a.program_section_id).localeCompare(String(b.program_section_id)));
    event.representative = event.sessions[0];
  }
  return events;
}

export const eventStatus = (event) => {
  const statuses = new Set(event.sessions.map((s) => s.status));
  return statuses.size === 1 ? [...statuses][0] : 'ongoing';
};

export const eventStudentTotal = (event) => event.sessions.reduce((sum, s) => sum + (s.total_learners || 0), 0);

export function eventLabel(event, singleLabel) {
  if (!event.groupId) return singleLabel(event.representative);
  const s = event.representative;
  return `${s.date} ${s.start_time} · ${s.subject_name} · ${s.faculty_name} · Combined: ${event.sessions.length} classes, ${eventStudentTotal(event)} students (${eventStatus(event)})`;
}

/** The version of every class row, as the group actions require. */
export const groupVersions = (event) => event.sessions.map((s) => ({ sessionId: s.id, version: s.version }));

/**
 * Trainers that can take the whole group: each has a valid mapping in every class.
 * mappingIds follow the order of event.sessions, one per class.
 */
export function groupReplacementOptions(event, eligibleFor) {
  const perClass = event.sessions.map((s) => eligibleFor(s).filter((m) => m.staff_id !== s.organization_staff_id));
  const options = [];
  for (const first of perClass[0] || []) {
    if (options.some((o) => o.staffId === first.staff_id)) continue;
    const mappings = perClass.map((list) => list.find((m) => m.staff_id === first.staff_id));
    if (mappings.every(Boolean)) options.push({ staffId: first.staff_id, staffName: first.staff_name, mappingIds: mappings.map((m) => m.id) });
  }
  return options;
}
