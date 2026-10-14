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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
  { id: 'relocate', label: 'Relocate' },
  { id: 'reassign_mapping', label: 'Reassign' },
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

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
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
  const [data, setData] = useState({ staff: [], mappings: [], sessions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('map');
  const [mappingId, setMappingId] = useState('');
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
  const session = data.sessions.find((s) => s.id === sessionId);
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
      setForm({
        collegeId: m.college_id,
        departmentId: m.department_id,
        programId: m.program_id,
        sectionId: m.section_id,
        specializationId: m.metadata?.specializations?.[0] || '',
        assignedCourses: m.assigned_courses || [],
        startDate: m.start_date,
        endDate: m.end_date || '',
        notes: m.notes || '',
      });
    }
  }

  function handleSaveMapping() {
    const m = data.mappings.find((x) => x.id === mappingId);
    if (mode !== 'map' && !m) {
      setError('Select an existing mapping.');
      return;
    }
    run(
      mode,
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
      mode === 'map' ? 'Mapping added successfully.' : 'Mapping updated successfully.'
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
            <Skeleton className="h-5 w-40" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Profile */}
            <section className="space-y-3">
              <SectionTitle>Educator profile</SectionTitle>
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
              <Button variant="outline" size="sm" disabled={busy} onClick={() => run('edit_profile', { staffId: educator.id, ...profile }, 'Profile updated successfully.')}>
                Save profile
              </Button>
            </section>

            <Separator />

            {/* Mapping */}
            <section className="space-y-4">
              <SectionTitle>Course / class mapping</SectionTitle>
              <Field label="Action" htmlFor="teaching-mode">
                <Select
                  value={mode}
                  disabled={busy}
                  onValueChange={(value) => {
                    setMode(value);
                    setMappingId('');
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

              {mode === 'reassign_mapping' && (
                <Field label="New educator" htmlFor="teaching-staff">
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
                  <Field label="Reason" htmlFor="teaching-reason">
                    <Input
                      id="teaching-reason"
                      value={reason}
                      disabled={busy}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Why is this mapping changing?"
                    />
                  </Field>
                  <p className="text-sm text-muted-foreground">
                    Completed classes stay unchanged. Reassignment updates compatible scheduled
                    classes from the selected start date. Before changing a destination, class or
                    course, cancel or replace affected future sessions below.
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
            </section>

            <Separator />

            {/* Sessions */}
            <section className="space-y-4">
              <SectionTitle>Attendance, replacement &amp; swaps</SectionTitle>
              <p className="text-sm text-muted-foreground">
                Showing the latest 300 training sessions. Educator attendance is separate from
                learner attendance.
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
                    {data.sessions.map((s) => (
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
                    Educator attendance: {session.staff_attendance_status || 'Unmarked'} · Original
                    educator:{' '}
                    {data.staff.find((s) => s.id === session.original_organization_staff_id)
                      ?.first_name || 'Previous educator'}
                  </p>

                  <Field label="Reason / attendance remarks" htmlFor="teaching-session-reason">
                    <Input
                      id="teaching-session-reason"
                      value={reason}
                      disabled={busy}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>

                  <Field label="Educator attendance" htmlFor="teaching-attendance">
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

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
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
                      disabled={busy}
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

                  <Field label="Replacement educator mapping" htmlFor="teaching-replacement">
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
                    disabled={busy || !replacementId}
                    onClick={() =>
                      run(
                        'replace',
                        { sessionId, version: session.version, mappingId: replacementId, reason },
                        'Session reassigned successfully.'
                      )
                    }
                  >
                    Replace / reassign this session
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
                      <p className="text-sm text-muted-foreground">
                        Select the second educator&apos;s mapping to the first class above, and the
                        first educator&apos;s mapping to the second class below.
                      </p>
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
                        disabled={busy}
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
                            {c.at} · Educator {c.staffId} · Attendance {c.staffAttendance || 'Unmarked'} · {c.reason}
                          </p>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
