// SP Admin combined groups: the active mappings (one per class) that share combined_class_group_id for one educator and course.

/** Combined groups of the given mappings, one entry per group id. Ended mappings and normal mappings are ignored. */
export function groupMappingsByCombinedGroup(mappings) {
  const groups = new Map();
  for (const m of mappings || []) {
    if (!m.combined_class_group_id || !m.is_active) continue;
    if (!groups.has(m.combined_class_group_id)) groups.set(m.combined_class_group_id, { groupId: m.combined_class_group_id, mappings: [] });
    groups.get(m.combined_class_group_id).mappings.push(m);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    staffId: g.mappings[0].staff_id,
    staffName: g.mappings[0].staff_name,
    mappings: g.mappings.sort((a, b) => `${a.program_name}${a.semester}${a.section}`.localeCompare(`${b.program_name}${b.semester}${b.section}`)),
  }));
}

/** Slots as comparable text ("09:00-16:00,17:00-21:00"), whatever the time format ("09:00" or "09:00:00"). */
export const slotsKey = (slots) => (slots || [])
  .map((s) => `${String(s.start_time).slice(0, 5)}-${String(s.end_time).slice(0, 5)}`).sort().join(',');

/**
 * An existing ordinary mapping of the educator for this class and course can be grouped instead of creating a duplicate,
 * but only when it has no time slots yet or exactly the slots chosen for the group.
 */
export function reusableMapping(mappings, staffId, sectionId, courseId, slots) {
  return (mappings || []).find((m) => m.is_active && m.staff_id === staffId && m.section_id === sectionId
    && !m.combined_class_group_id && Array.isArray(m.assigned_courses) && m.assigned_courses.length === 1 && m.assigned_courses[0] === courseId
    && (!slots || !Array.isArray(m.time_slots) || m.time_slots.length === 0 || slotsKey(m.time_slots) === slotsKey(slots)));
}

const LATEST = '9999-12-31';

/** True when the mapping's dates overlap the given dates. Without a start date the dates are unknown, so they are assumed to overlap. */
export const datesOverlap = (m, startDate, endDate) => !startDate
  || (String(m.start_date).slice(0, 10) <= (endDate || LATEST) && (m.end_date ? String(m.end_date).slice(0, 10) : LATEST) >= startDate);

/**
 * A class the educator already holds an active mapping for with the same course during the same dates, which cannot simply be reused
 * (other slots or already grouped). A mapping for another course, or on other dates, does not clash: the database allows several
 * mappings of one educator and class as long as they do not share a course on overlapping dates (migration 20270118000000).
 */
export function conflictingMapping(mappings, staffId, sectionId, courseId, slots, startDate, endDate) {
  const reusable = reusableMapping(mappings, staffId, sectionId, courseId, slots);
  return (mappings || []).find((m) => m.is_active && m.staff_id === staffId && m.section_id === sectionId
    && m !== reusable && Array.isArray(m.assigned_courses) && m.assigned_courses.includes(courseId) && datesOverlap(m, startDate, endDate));
}

// ---- labels: department > programme (one per specialization) > semester + section = a class ----

/** Specializations of a programme, as text ("Finance"), or '' when the programme has none. */
export const specializationText = (program) => {
  const specs = Array.isArray(program?.specializations) ? program.specializations.map((s) => String(s).trim()).filter(Boolean) : [];
  return specs.join(', ');
};

/** "Master of Business Administration (MBA) - Finance"; a programme without a specialization has no suffix. */
export const programTitle = (program) => {
  const code = program.code ? ` (${program.code})` : '';
  const spec = specializationText(program);
  return `${program.name}${code}${spec ? ` - ${spec}` : ''}`;
};

/** "Semester 4 · Section A · 2026-27" */
export const classRowLabel = (section) =>
  `Semester ${section.semester} · Section ${section.section}${section.academic_year ? ` · ${section.academic_year}` : ''}`;

/** A mapping's class with its department and programme (and specialization) when they are known. */
export const mappingClassLabel = (mapping, programsById, departmentsById) => {
  const program = programsById?.[mapping.program_id];
  const department = departmentsById?.[mapping.department_id];
  const place = `${program ? programTitle(program) : mapping.program_name} · Semester ${mapping.semester} · Section ${mapping.section}`;
  return department ? `${department.name} · ${place}` : place;
};

/** Programme blocks: each programme with its own classes (a programme without classes keeps an empty list). */
export function programBlocks(programs, sectionsByProgram) {
  return (programs || []).map((program) => ({
    program,
    title: programTitle(program),
    classes: (sectionsByProgram?.[program.id] || []).map((s) => ({ sectionId: s.id, label: classRowLabel(s) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  }));
}

/** Department > programme > class blocks for one college, so classes of different departments can be combined. */
export function departmentBlocks(departments, programsByDepartment, sectionsByProgram) {
  return (departments || []).map((department) => ({
    department,
    programs: programBlocks(programsByDepartment?.[department.id], sectionsByProgram),
  }));
}
