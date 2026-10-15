'use client'
import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import CollegeAssignmentForm from './CollegeAssignmentForm';

const NONE = 'none';

const emptyForm = {
  collegeId: '',
  departmentId: '',
  programId: '',
  sectionId: '',
  specializationId: '',
  assignedCourses: [],
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  notes: '',
};

const PROFILE_FIELDS = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'phone', label: 'Phone' },
  { key: 'qualification', label: 'Qualification' },
];

const MODE_OPTIONS = [
  { id: 'map', label: 'Add mapping' },
  { id: 'edit_mapping', label: 'Edit mapping' },
  { id: 'end_mapping', label: 'End mapping' },
];

const ATTENDANCE_OPTIONS = ['present', 'absent', 'late', 'excused'];

async function operation(action, payload) {
  const response = await fetch('/api/educators/teaching', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Teaching operation failed');
  return data.data;
}

function Field({ label, htmlFor, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export default function EducatorTeachingManager({ educator, onClose, onSaved }) {
  const { toast } = useToast();
  const [tab, setTab] = useState('profile');
  const [data, setData] = useState({ staff: [], mappings: [], sessions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('map');
  const [mappingId, setMappingId] = useState('');
  const [origMapping, setOrigMapping] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [staffId, setStaffId] = useState(educator.id);
  const [reason, setReason] = useState('');
  const [profile, setProfile] = useState({
    firstName: educator.firstName,
    lastName: educator.lastName,
    phone: educator.phone || '',
    qualification: educator.qualification || '',
  });
  const [sessionId, setSessionId] = useState('');
  const [otherId, setOtherId] = useState('');
  const [replacementId, setReplacementId] = useState('');
  const [otherMappingId, setOtherMappingId] = useState('');
  const [attendance, setAttendance] = useState('present');

  async function refresh() {
    const response = await fetch('/api/educators/teaching', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not load teaching management');
    setData(body.data);
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch('/api/educators/teaching', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Could not load teaching management');
        if (alive) setData(body.data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function run(action, payload, successMessage = 'Saved successfully.') {
    setBusy(true);
    setError('');
    try {
      await operation(action, payload);
      await refresh();
      await onSaved?.();
      toast({ title: 'Success', description: successMessage });
    } catch (e) {
      setError(e.message);
      toast({ title: 'Action failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const ownMappings = data.mappings.filter((m) => m.staff_id === educator.id && m.is_active);
  const reasonOk = reason.trim().length > 0;
  // This card manages ONE educator — the session picker shows only their
  // sessions, never other trainers'. (Swap counterpart picker stays global.)
  const ownSessions = data.sessions.filter((s) => s.organization_staff_id === educator.id);
  const session = ownSessions.find((s) => s.id === sessionId);
  const other = data.sessions.find((s) => s.id === otherId);
  const sessionLabel = (s) =>
    `${s.date} ${s.start_time} · ${s.subject_name} · ${s.faculty_name} · ${s.section} (${s.status})`;
  const mappingLabel = (m) =>
    `${m.staff_name} · ${m.college_name} · ${m.program_name} · Sem ${m.semester} / ${m.section}`;

  function eligible(s) {
    return data.mappings.filter(
      (m) =>
        m.is_active &&
        m.college_id === s?.college_id &&
        m.section_id === s?.program_section_id &&
        m.assigned_courses?.includes(s?.lms_course_id) &&
        m.start_date <= s.date &&
        (!m.end_date || m.end_date >= s.date)
    );
  }

  function chooseMapping(id) {
    const nextId = id === NONE ? '' : id;
    setMappingId(nextId);
    const m = data.mappings.find((x) => x.id === nextId);
    if (m) {
      setStaffId(m.staff_id);
      const snapshot = {
        staffId: m.staff_id,
        collegeId: m.college_id,
        departmentId: m.department_id,
        programId: m.program_id,
        sectionId: m.section_id,
        specializationId: m.metadata?.specializations?.[0] || '',
        assignedCourses: [...(m.assigned_courses || [])].sort(),
        startDate: m.start_date,
        endDate: m.end_date || '',
      };
      setOrigMapping(snapshot);
      setForm({
        collegeId: snapshot.collegeId,
        departmentId: snapshot.departmentId,
        programId: snapshot.programId,
        sectionId: snapshot.sectionId,
        specializationId: snapshot.specializationId,
        assignedCourses: [...(m.assigned_courses || [])],
        startDate: snapshot.startDate,
        endDate: snapshot.endDate,
        notes: m.notes || '',
      });
    } else {
      setOrigMapping(null);
    }
  }

  // Edit mode auto-detects the real operation so Relocate/Reassign need no
  // separate modes: a different educator => reassign, a different
  // destination => relocate, otherwise a plain edit. Audit labels preserved.
  function detectEditAction(m) {
    if (staffId !== m.staff_id) return 'reassign_mapping';
    const sameCourses =
      [...form.assignedCourses].sort().join('|') === (origMapping?.assignedCourses || []).join('|');
    const moved =
      form.collegeId !== origMapping?.collegeId ||
      form.departmentId !== origMapping?.departmentId ||
      form.programId !== origMapping?.programId ||
      form.sectionId !== origMapping?.sectionId ||
      (form.specializationId || '') !== (origMapping?.specializationId || '') ||
      !sameCourses ||
      form.startDate !== (origMapping?.startDate || '') ||
      (form.endDate || '') !== (origMapping?.endDate || '');
    return moved ? 'relocate' : 'edit_mapping';
  }

  function handleSaveMapping() {
    const m = data.mappings.find((x) => x.id === mappingId);
    if (mode !== 'map' && !m) {
      setError('Select an existing mapping.');
      return;
    }
    // Mirror the teaching-contract requirements so failures surface
    // as actionable messages instead of "Invalid teaching request".
    if (mode !== 'map' && !reason.trim()) {
      setError('Reason is required for this action — it is recorded in the audit trail.');
      return;
    }
    if (mode === 'end_mapping' && !form.endDate) {
      setError('End date is required to end a mapping.');
      return;
    }
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      setError('End date cannot be before the start date.');
      return;
    }
    if (mode !== 'end_mapping') {
      if (!form.collegeId || !form.sectionId) {
        setError('Select a college, department, program and section first.');
        return;
      }
      if (form.assignedCourses.length === 0) {
        setError('Select at least one course for this mapping.');
        return;
      }
    }
    const effectiveAction = mode === 'map' ? 'map' : mode === 'end_mapping' ? 'end_mapping' : detectEditAction(m);
    const successMessages = {
      map: 'Mapping added successfully.',
      edit_mapping: 'Mapping updated successfully.',
      relocate: 'Trainer relocated successfully.',
      reassign_mapping: 'Mapping reassigned successfully.',
      end_mapping: 'Mapping ended successfully.',
    };
    run(
      effectiveAction,
      mode === 'end_mapping'
        ? { mappingId, version: m.assignment_version, reason, endDate: form.endDate }
        : {
            staffId,
            collegeId: form.collegeId,
            sectionId: form.sectionId,
            courseIds: form.assignedCourses,
            specializations: form.specializationId ? [form.specializationId] : [],
            startDate: form.startDate,
            endDate: form.endDate,
            notes: form.notes,
            ...(mode === 'map' ? {} : { mappingId, version: m.assignment_version, reason }),
          },
      successMessages[effectiveAction]
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Manage {educator.firstName} {educator.lastName}
          </DialogTitle>
          <DialogDescription>
            {educator.email}
            {educator.employeeId ? ` · ${educator.employeeId}` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-9 w-full" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="mapping">Mapping</TabsTrigger>
                <TabsTrigger value="sessions">Sessions</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {PROFILE_FIELDS.map((field) => (
                    <Field key={field.key} label={field.label} htmlFor={`teaching-${field.key}`}>
                      <Input
                        id={`teaching-${field.key}`}
                        value={profile[field.key]}
                        disabled={busy}
                        onChange={(e) => setProfile({ ...profile, [field.key]: e.target.value })}
                      />
                    </Field>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (!profile.firstName.trim() || !profile.lastName.trim()) {
                      setError('First name and last name are required.');
                      return;
                    }
                    run(
                      'edit_profile',
                      { staffId: educator.id, ...profile },
                      'Profile updated successfully.'
                    );
                  }}
                >
                  Save profile
                </Button>
              </TabsContent>

              <TabsContent value="mapping" className="space-y-4 pt-2">
                <Field label="Action" htmlFor="teaching-mode">
                  <Select
                    value={mode}
                    disabled={busy}
                    onValueChange={(value) => {
                      setMode(value);
                      setMappingId('');
                      setOrigMapping(null);
                      setStaffId(educator.id);
                      setForm({ ...emptyForm });
                    }}
                  >
                    <SelectTrigger id="teaching-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODE_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {mode !== 'map' && (
                  <Field label="Existing mapping" htmlFor="teaching-mapping">
                    <Select value={mappingId || NONE} disabled={busy} onValueChange={chooseMapping}>
                      <SelectTrigger id="teaching-mapping">
                        <SelectValue placeholder="Select mapping" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Select mapping</SelectItem>
                        {ownMappings.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {mappingLabel(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}

                {mode === 'edit_mapping' && mappingId && (
                  <Field label="New educator (optional — leave to keep current trainer)" htmlFor="teaching-staff">
                    <Select value={staffId} disabled={busy} onValueChange={setStaffId}>
                      <SelectTrigger id="teaching-staff">
                        <SelectValue placeholder="Select educator" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.staff
                          .filter((s) => s.account_status === 'active')
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.first_name} {s.last_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}

                {mode !== 'end_mapping' && (
                  <CollegeAssignmentForm form={form} setForm={setForm} isLoading={busy} />
                )}

                {mode !== 'map' && (
                  <>
                    <Field label="Reason *" htmlFor="teaching-reason">
                      <Input
                        id="teaching-reason"
                        value={reason}
                        disabled={busy}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why is this mapping changing? (required)"
                      />
                    </Field>
                    <p className="text-sm text-muted-foreground">
                      Completed classes stay unchanged. Reassignment updates compatible scheduled
                      classes from the selected start date.
                    </p>
                  </>
                )}

                {mode === 'end_mapping' && (
                  <Field label="End date" htmlFor="teaching-end-date">
                    <Input
                      id="teaching-end-date"
                      type="date"
                      value={form.endDate}
                      disabled={busy}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    />
                  </Field>
                )}

                <Button
                  disabled={busy}
                  onClick={handleSaveMapping}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                >
                  Save mapping
                </Button>
              </TabsContent>

              <TabsContent value="sessions" className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Latest 300 training sessions. Educator attendance is separate from learner
                  attendance.
                </p>

                <Field label="Session" htmlFor="teaching-session">
                  <Select
                    value={sessionId || NONE}
                    disabled={busy}
                    onValueChange={(value) => {
                      setSessionId(value === NONE ? '' : value);
                      setReplacementId('');
                    }}
                  >
                    <SelectTrigger id="teaching-session">
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Select session</SelectItem>
                      {ownSessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {sessionLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {session && (
                  <div className="space-y-4 rounded-xl border p-4">
                    <p className="text-sm text-muted-foreground">
                      Attendance: {session.staff_attendance_status || 'Unmarked'} · Original
                      educator:{' '}
                      {data.staff.find((s) => s.id === session.original_organization_staff_id)
                        ?.first_name || 'Previous educator'}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Reason / remarks *" htmlFor="teaching-session-reason">
                        <Input
                          id="teaching-session-reason"
                          value={reason}
                          disabled={busy}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Required — recorded in the audit trail"
                        />
                      </Field>
                      <Field label="Attendance" htmlFor="teaching-attendance">
                        <Select value={attendance} disabled={busy} onValueChange={setAttendance}>
                          <SelectTrigger id="teaching-attendance">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ATTENDANCE_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                  </Select>
                </Field>

                {!session && ownSessions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No sessions assigned to this educator yet.
                  </p>
                )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || !reasonOk}
                        title={!reasonOk ? 'Enter a reason first' : undefined}
                        onClick={() =>
                          run(
                            'mark_staff',
                            { sessionId, version: session.version, status: attendance, reason },
                            'Attendance recorded successfully.'
                          )
                        }
                      >
                        Mark attendance
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || !reasonOk}
                        title={!reasonOk ? 'Enter a reason first' : undefined}
                        onClick={() =>
                          run(
                            'cancel_session',
                            { sessionId, version: session.version, reason },
                            'Session cancelled successfully.'
                          )
                        }
                      >
                        Cancel session
                      </Button>
                    </div>

                    <Field label="Replacement mapping" htmlFor="teaching-replacement">
                      <Select
                        value={replacementId || NONE}
                        disabled={busy}
                        onValueChange={(value) => setReplacementId(value === NONE ? '' : value)}
                      >
                        <SelectTrigger id="teaching-replacement">
                          <SelectValue placeholder="Select eligible replacement" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Select eligible replacement</SelectItem>
                          {eligible(session)
                            .filter((m) => m.staff_id !== session.organization_staff_id)
                            .map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {mappingLabel(m)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || !replacementId || !reasonOk}
                      title={!reasonOk ? 'Enter a reason first' : undefined}
                      onClick={() =>
                        run(
                          'replace',
                          { sessionId, version: session.version, mappingId: replacementId, reason },
                          'Session reassigned successfully.'
                        )
                      }
                    >
                      Replace this session
                    </Button>

                    <Field label="Other session for swap" htmlFor="teaching-other-session">
                      <Select
                        value={otherId || NONE}
                        disabled={busy}
                        onValueChange={(value) => {
                          setOtherId(value === NONE ? '' : value);
                          setOtherMappingId('');
                        }}
                      >
                        <SelectTrigger id="teaching-other-session">
                          <SelectValue placeholder="Select second session" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Select second session</SelectItem>
                          {data.sessions
                            .filter((s) => s.id !== sessionId)
                            .map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {sessionLabel(s)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    {other && (
                      <>
                        <Field
                          label="First educator's mapping to second class"
                          htmlFor="teaching-other-mapping"
                        >
                          <Select
                            value={otherMappingId || NONE}
                            disabled={busy}
                            onValueChange={(value) =>
                              setOtherMappingId(value === NONE ? '' : value)
                            }
                          >
                            <SelectTrigger id="teaching-other-mapping">
                              <SelectValue placeholder="Select mapping" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Select mapping</SelectItem>
                              {eligible(other)
                                .filter((m) => m.staff_id === session.organization_staff_id)
                                .map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {mappingLabel(m)}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy || !reasonOk || !otherId || !otherMappingId || !replacementId}
                          title={!reasonOk ? 'Enter a reason first' : (!otherId || !otherMappingId || !replacementId ? 'Select the other session and both mappings first' : undefined)}
                          onClick={() =>
                            run(
                              'swap',
                              {
                                sessionId,
                                version: session.version,
                                otherSessionId: other.id,
                                otherVersion: other.version,
                                mappingId: replacementId,
                                otherMappingId,
                                reason,
                              },
                              'Sessions swapped successfully.'
                            )
                          }
                        >
                          Swap both educators
                        </Button>
                      </>
                    )}

                    {session.instructor_changes?.length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium">
                          Previous instructor / attendance details
                        </summary>
                        <div className="mt-2 space-y-1 text-muted-foreground">
                          {session.instructor_changes.map((c, i) => (
                            <p key={i}>
                              {c.at} · Educator {c.staffId} · Attendance{' '}
                              {c.staffAttendance || 'Unmarked'} · {c.reason}
                            </p>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
