'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimeSlotsEditor, validateTimeSlots } from './CollegeAssignmentForm';
import { conflictingMapping, departmentBlocks, groupMappingsByCombinedGroup, mappingClassLabel, reusableMapping } from './combinedGroups';

const today = () => new Date().toISOString().slice(0, 10);
const selectClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

async function getJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  if (!body.success) throw new Error(body.error || 'Could not load the list');
  return body.data || [];
}

/**
 * Combined group of the educator being managed: classes that are taught together for one course, in one college.
 * The classes may belong to different departments and programmes. Each class still gets its own ordinary mapping
 * (existing `map` action); `group_mappings` then ties them together as one approved group.
 */
export default function CombinedGroupPanel({ educator, mappings, busy, runSteps, operation }) {
  const [colleges, setColleges] = useState([]);
  const [collegeId, setCollegeId] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [picked, setPicked] = useState([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(null);
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');
  const [timeSlots, setTimeSlots] = useState([]);
  const [error, setError] = useState('');
  const [endReason, setEndReason] = useState('');
  const [endDay, setEndDay] = useState(today());
  const [programsById, setProgramsById] = useState({});
  const [departmentsById, setDepartmentsById] = useState({});

  const groups = useMemo(() => groupMappingsByCombinedGroup(mappings.filter((m) => m.staff_id === educator.id)), [mappings, educator.id]);

  useEffect(() => { getJson('/api/colleges').then(setColleges).catch((e) => setError(e.message)); }, []);

  // Every department of the college, each with its programmes and their classes (sections).
  useEffect(() => {
    setBlocks([]); setPicked([]);
    if (!collegeId) return;
    let alive = true;
    setLoadingClasses(true);
    (async () => {
      const departments = await getJson(`/api/departments?collegeId=${collegeId}`);
      const programLists = await Promise.all(departments.map((d) => getJson(`/api/programs?departmentId=${d.id}`)));
      const programs = programLists.flat();
      const sectionLists = await Promise.all(programs.map((p) => getJson(`/api/sections?programId=${p.id}`)));
      if (!alive) return;
      setBlocks(departmentBlocks(
        departments,
        Object.fromEntries(departments.map((d, i) => [d.id, programLists[i]])),
        Object.fromEntries(programs.map((p, i) => [p.id, sectionLists[i]])),
      ));
    })().catch((e) => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoadingClasses(false); });
    return () => { alive = false; };
  }, [collegeId]);

  // Course search (the course list is large, so it is looked up by name or code; a course is not tied to a department).
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      const query = `limit=20${courseSearch.trim() ? `&search=${encodeURIComponent(courseSearch.trim())}` : ''}`;
      getJson(`/api/courses?${query}`).then((list) => { if (alive) setCourses(list); }).catch((e) => { if (alive) setError(e.message); });
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [courseSearch]);

  // Department and programme names of this educator's existing groups, so each class is shown in full.
  const groupColleges = [...new Set(groups.flatMap((g) => g.mappings.map((m) => m.college_id)).filter(Boolean))].sort().join(',');
  useEffect(() => {
    if (!groupColleges) return;
    let alive = true;
    (async () => {
      const departments = (await Promise.all(groupColleges.split(',').map((id) => getJson(`/api/departments?collegeId=${id}`)))).flat();
      const programs = (await Promise.all(departments.map((d) => getJson(`/api/programs?departmentId=${d.id}`)))).flat();
      if (!alive) return;
      setDepartmentsById(Object.fromEntries(departments.map((d) => [d.id, d])));
      setProgramsById(Object.fromEntries(programs.map((p) => [p.id, p])));
    })().catch(() => {});
    return () => { alive = false; };
  }, [groupColleges]);

  const toggle = (sectionId) => setPicked((prev) => (prev.includes(sectionId) ? prev.filter((x) => x !== sectionId) : [...prev, sectionId]));
  const canSave = picked.length >= 2 && course && collegeId && startDate && endDate && endDate >= startDate;
  const mappingText = (m) => `${m.college_name} · ${mappingClassLabel(m, programsById, departmentsById)}`;

  function save() {
    setError('');
    // Same checks as the normal mapping form: at least one valid slot, start before end.
    const slotError = validateTimeSlots(timeSlots);
    if (slotError) {
      setError(slotError);
      return;
    }
    const clash = picked.map((sectionId) => conflictingMapping(mappings, educator.id, sectionId, course.course_id, timeSlots, startDate, endDate)).find(Boolean);
    if (clash) {
      setError(`This educator already has a different mapping for ${mappingText(clash)} on these dates. Change the dates or end it first.`);
      return;
    }
    runSteps(async () => {
      // One ordinary mapping per class (reusing an existing identical one), then tie them together as one approved group.
      const mappingIds = [];
      for (const sectionId of picked) {
        const reuse = reusableMapping(mappings, educator.id, sectionId, course.course_id, timeSlots);
        if (reuse) { mappingIds.push(reuse.id); continue; }
        const created = await operation('map', {
          staffId: educator.id, collegeId, sectionId, courseIds: [course.course_id], specializations: [],
          startDate, endDate, notes: 'Combined group', time_slots: [],
        });
        mappingIds.push(created.mappingId);
      }
      // The shared slots are saved once for the whole group (every class gets the same list) and checked against the educator's other mappings.
      await operation('group_mappings', { mappingIds, time_slots: timeSlots.map((s) => ({ start_time: s.start_time, end_time: s.end_time })) });
      setPicked([]);
      setTimeSlots([]);
    }, 'Combined group saved. The college admin can now schedule it.');
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A combined group is a set of classes of one college that this educator teaches together for one course. The classes can belong to different
        departments and programmes. The educator gets one mapping per class, and the college admin can then schedule the group as a single session.
      </p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="space-y-1">
        <Label htmlFor="combined-college">College</Label>
        <select id="combined-college" className={selectClass} value={collegeId} disabled={busy} onChange={(e) => setCollegeId(e.target.value)}>
          <option value="">Select college</option>
          {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Classes taught together (choose at least two)</legend>
        <p className="text-xs text-muted-foreground">
          Classes are listed by department, then programme (with its specialization), then semester and section.
        </p>
        {!blocks.length && <p className="text-sm text-muted-foreground">{collegeId ? (loadingClasses ? 'Loading departments, programmes and classes...' : 'This college has no departments.') : 'Choose a college to list its classes.'}</p>}
        {blocks.map((deptBlock) => (
          <details key={deptBlock.department.id} open className="rounded-md border p-3 space-y-2">
            <summary className="cursor-pointer text-sm font-semibold">{deptBlock.department.name}</summary>
            {!deptBlock.programs.length && <p className="text-xs text-muted-foreground">No programmes in this department.</p>}
            {deptBlock.programs.map((block) => (
              <div key={block.program.id} className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium">{block.title}</p>
                {!block.classes.length && <p className="text-xs text-muted-foreground">No classes (sections) are created for this programme.</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {block.classes.map((c) => (
                    <label key={c.sectionId} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <input type="checkbox" checked={picked.includes(c.sectionId)} disabled={busy} onChange={() => toggle(c.sectionId)} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </details>
        ))}
        {picked.length > 0 && <p className="text-xs text-muted-foreground">{picked.length} class{picked.length === 1 ? '' : 'es'} selected.</p>}
      </fieldset>

      <div className="space-y-1">
        <Label htmlFor="combined-course-search">Course (the same course for every class)</Label>
        <Input id="combined-course-search" placeholder="Search course by name or code" value={courseSearch} disabled={busy} onChange={(e) => setCourseSearch(e.target.value)} />
        <select aria-label="Course" className={selectClass} value={course?.course_id || ''} disabled={busy || !courses.length}
          onChange={(e) => setCourse(courses.find((c) => c.course_id === e.target.value) || null)}>
          <option value="">{course ? `${course.title} (${course.code})` : 'Select course'}</option>
          {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.title} ({c.code})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="combined-start">Mapping start date</Label>
          <Input id="combined-start" type="date" value={startDate} disabled={busy} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="combined-end">Mapping end date</Label>
          <Input id="combined-end" type="date" value={endDate} disabled={busy} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <TimeSlotsEditor slots={timeSlots} onChange={setTimeSlots} />
      <p className="text-xs text-muted-foreground">
        The same time slots apply to every class in the group. The educator can teach all of these classes in these slots, and the slots must not
        overlap the educator's other mappings.
      </p>

      <Button disabled={busy || !canSave} onClick={save} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">Save combined group</Button>

      <div className="space-y-2 border-t pt-4">
        <h3 className="text-sm font-semibold">Combined groups</h3>
        {!groups.length && <p className="text-sm text-muted-foreground">No combined group has been created yet.</p>}
        {groups.map((g) => (
          <div key={g.groupId} className="rounded-lg border p-3 text-sm space-y-2">
            <p className="font-medium">{g.mappings.length} classes · {g.mappings[0].start_date} to {g.mappings[0].end_date || 'open'}</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {g.mappings.map((m) => <li key={m.id}>{m.college_name} · {mappingClassLabel(m, programsById, departmentsById)}</li>)}
            </ul>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input aria-label="End date for the group" type="date" value={endDay} disabled={busy} onChange={(e) => setEndDay(e.target.value)} />
              <Input aria-label="Reason for ending the group" value={endReason} disabled={busy} placeholder="Reason (required)" onChange={(e) => setEndReason(e.target.value)} />
              <Button variant="outline" size="sm" disabled={busy || !endReason.trim() || !endDay}
                onClick={() => runSteps(() => operation('end_mapping_group', { groupId: g.groupId, endDate: endDay, reason: endReason }), 'Combined group ended.')}>
                End combined group
              </Button>
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">A grouped mapping cannot be edited on its own. End the combined group and create a new one instead.</p>
      </div>
    </div>
  );
}
