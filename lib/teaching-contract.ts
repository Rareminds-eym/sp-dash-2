import { z } from 'zod';
const id = z.string().uuid();
const version = z.number().int().positive();
const reason = z.string().trim().min(1).max(1000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().startsWith(value), 'Invalid date');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);
const timeSlot = z.object({
  start_time: time,
  end_time: time,
});
const map = z.object({ staffId: id, collegeId: id, sectionId: id, courseIds: z.array(id).min(1).max(100),
  specializations: z.array(z.string().trim().min(1).max(150)).max(50).default([]), startDate: date,
  endDate: z.union([date, z.literal('')]).optional(), notes: z.string().max(2000).optional(),
  time_slots: z.array(timeSlot).max(50).optional().default([]),
  mappingId: id.optional(), version: version.optional(), reason: reason.optional() });
// Combined class sessions: one session row per class sharing a group id (see external_educator_combined_action).
// Trainer swap is intentionally not offered for combined sessions in version 1.
const attendanceStatus = z.enum(['present','absent','late','excused']);
const combinedSessions = z.array(z.object({ sessionId: id, version })).min(2).max(10);
const schemas: Record<string, z.ZodTypeAny> = {
  context: z.object({}), admin_overview: z.object({}), learners: z.object({}), courses: z.object({}), sessions: z.object({}),
  map,
  course_content: z.object({courseId:id}),
  class_sections: z.object({collegeId:id,programId:id,semester:z.number().int().positive()}),
  college_sessions: z.object({collegeId:id}),
  edit_mapping: map.extend({ mappingId: id, version, reason }), relocate: map.extend({ mappingId: id, version, reason }),
  reassign_mapping: map.extend({ mappingId: id, version, reason }),
  end_mapping: z.object({ mappingId: id, version, reason, endDate: date }),
  edit_profile: z.object({ staffId: id, firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100),
    phone: z.string().max(30).optional(), qualification: z.string().max(255).optional() }),
  deactivate_staff: z.object({staffId:id,reason}),
  mapped_courses: z.object({ collegeId: id, sectionId: id, date }),
  create_session: z.object({ mappingId: id, courseId: id, mappingVersion: version, date, startTime: time, endTime: time,
    requestId: id, room: z.string().max(50).optional(), remarks: z.string().max(2000).optional() }),
  session_roster: z.object({ sessionId: id }),
  mark_learners: z.object({ sessionId: id, version, attendanceRevision: z.number().int().nonnegative(),
    records: z.array(z.object({ learnerId: id, status: z.enum(['present','absent','late','excused']) })).min(1).max(1000) }),
  mark_staff: z.object({ sessionId: id, version, status: z.enum(['present','absent','late','excused']), reason }),
  cancel_session: z.object({ sessionId: id, version, reason }),
  replace: z.object({ sessionId: id, version, mappingId: id, reason }),
  swap: z.object({ sessionId: id, version, otherSessionId: id, otherVersion: version, mappingId: id, otherMappingId: id, reason }),
  create_combined_session: z.object({ approvedGroupId: id, mappings: z.array(z.object({ mappingId: id, mappingVersion: version })).min(2).max(10),
    courseId: id, date, startTime: time, endTime: time, requestId: id, room: z.string().max(50).optional(), remarks: z.string().max(2000).optional() }),
  cancel_combined_session: z.object({ groupId: id, sessions: combinedSessions, reason }),
  replace_combined_session: z.object({ groupId: id, sessions: combinedSessions, mappingIds: z.array(id).min(2).max(10), reason }),
  mark_combined_staff: z.object({ groupId: id, sessions: combinedSessions, status: attendanceStatus, reason }),
  // SP Admin defines an approved combined group from existing per-class mappings; the college admin only schedules approved groups.
  group_mappings: z.object({ mappingIds: z.array(id).min(2).max(10), time_slots: z.array(timeSlot).min(1).max(50) }),
  end_mapping_group: z.object({ groupId: id, endDate: date, reason }),
  combined_groups: z.object({ collegeId: id, date }),
  mark_combined_learners: z.object({ groupId: id, sessions: z.array(z.object({ sessionId: id, version, attendanceRevision: z.number().int().nonnegative(),
    records: z.array(z.object({ learnerId: id, status: attendanceStatus })).min(1).max(1000) })).min(1).max(10) }),

};
export const PLATFORM_TEACHING_ADMIN_ACTIONS = new Set(['map','edit_mapping','relocate','reassign_mapping','end_mapping','edit_profile','deactivate_staff','admin_overview','mark_staff','replace','swap','cancel_session','cancel_combined_session','replace_combined_session','mark_combined_staff','group_mappings','end_mapping_group']);
export const COMBINED_TEACHING_ACTIONS = new Set(['group_mappings','end_mapping_group','combined_groups','create_combined_session','cancel_combined_session','replace_combined_session','mark_combined_staff','mark_combined_learners']);
/** Combined-session actions run in their own database function; every other action keeps using external_educator_action. */
export const teachingRpcName = (action: string) => COMBINED_TEACHING_ACTIONS.has(action) ? 'external_educator_combined_action' : 'external_educator_action';
export function parseTeachingRequest(value: unknown) {
  const envelope = z.object({ action: z.string(), payload: z.record(z.unknown()).default({}) }).parse(value);
  const schema = schemas[envelope.action];
  if (!schema) throw new Error('Unknown teaching action');
  return { action: envelope.action, payload: schema.parse(envelope.payload) };
}
export function teachingFailure(error: { code?: string; message?: string }) {
  if (error.code === '42501') return { status: 403, code: 'FORBIDDEN', message: 'This teaching operation is outside your assigned access.' };
  if (error.code === '40001') return { status: 409, code: 'CONFLICT', message: error.message || 'The record changed or the trainer is already booked. Refresh and try again.' };
  if (error.code === '40P01' || error.code === '23505') return { status: 409, code: 'CONFLICT', message: 'The record changed or the trainer is already booked. Refresh and try again.' };
  if (error.code === '42P01' || error.code === '42703' || error.code === 'PGRST202') return { status: 503, code: 'TEACHING_SCHEMA_UNAVAILABLE', message: 'The college teaching migration must be applied before this feature can run.' };
  if (error.code === 'P0002') return { status: 404, code: 'NOT_FOUND', message: 'Teaching record not found.' };
  return { status: 422, code: 'VALIDATION_ERROR', message: 'Check the course/class mapping, dates, status and required fields.' };
}
