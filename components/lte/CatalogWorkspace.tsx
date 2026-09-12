'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Briefcase,
  BookOpen,
  GitBranch,
  RotateCcw,
  Edit,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DraftEditorModal } from './DraftEditorModal';
import { FullCourseContentEditor } from './FullCourseContentEditor';
import { RollbackModal } from './RollbackModal';

export const CatalogWorkspace: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [courseDetail, setCourseDetail] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'capabilities' | 'roles' | 'courses'>('courses');
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [activeDraft, setActiveDraft] = useState<any>(null);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState<boolean>(false);
  const [isFullEditorOpen, setIsFullEditorOpen] = useState<boolean>(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState<boolean>(false);
  const [rollbackCourse, setRollbackCourse] = useState<any>(null);

  const { toast } = useToast();

  const refreshAll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lte/workspace?view=dashboard', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load catalog workspace');
      setSummary(data.summary);
      setCapabilities(data.capabilities || []);
      setRoles(data.roles || []);
      setCourses(data.courses || []);
    } catch (error: any) {
      toast({ title: 'Catalog Load Failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleSelectCourse = async (course: any) => {
    setSelectedCourse(course);
    try {
      const params = new URLSearchParams({ view: 'course_detail', id: course.sourceRecordId || course.id, source: course.sourceType || 'course', courseCode: course.course_code });
      const res = await fetch(`/api/admin/lte/workspace?${params}`);
      const data = await res.json();
      if (data.success) {
        setCourseDetail(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenDraft = async (course: any) => {
    if (course.sourceType !== 'course') return;
    
    // Open full content editor instead of simple draft modal
    setEditingCourseId(course.id);
    setIsFullEditorOpen(true);
  };

  const handleRetireReactivate = async (course: any) => {
    const action = course.lifecycle_status === 'RETIRED' ? 'REACTIVATE_COURSE' : 'RETIRE_COURSE';
    try {
      const res = await fetch('/api/admin/lte/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, courseId: course.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: `Course ${action === 'RETIRE_COURSE' ? 'Retired' : 'Reactivated'}`,
          description: `Course lifecycle status changed to ${data.lifecycleStatus}.`,
        });
        refreshAll();
      } else {
        toast({ title: 'Lifecycle Action Failed', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Action Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleBatchMaterialize = async () => {
    const levelsToMaterialize = courses.filter(c => c.sourceType === 'level');
    if (levelsToMaterialize.length === 0) {
      toast({ title: 'No Levels to Materialize', description: 'All courses are already materialized or are upload drafts.' });
      return;
    }

    const confirmed = window.confirm(`Materialize ${levelsToMaterialize.length} level(s) to courses? This will create course records for all published levels.`);
    if (!confirmed) return;

    try {
      const levelIds = levelsToMaterialize.map(l => l.id);
      const res = await fetch('/api/admin/lte/materialize-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levelIds }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Batch Materialize Complete',
          description: `${data.results.successful.length} created, ${data.results.skipped.length} skipped, ${data.results.failed.length} failed`,
        });
        refreshAll();
      } else {
        toast({ title: 'Batch Materialize Failed', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Batch Materialize Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleMaterialize = async (level: any) => {
    try {
      const res = await fetch('/api/admin/lte/materialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levelId: level.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Level Materialized',
          description: `Created course ${data.course.course_code} with initial version`,
        });
        refreshAll();
        // Auto-select the newly created course
        if (data.course) {
          const newCourse = {
            ...data.course,
            sourceType: 'course',
            rowKey: `course:${data.course.id}`,
            sourceRecordId: data.course.id,
            publishedVersionNo: 1,
            assignableStatus: 'PENDING_ASSET_READINESS',
          };
          setSelectedCourse(newCourse);
          handleSelectCourse(newCourse);
        }
      } else {
        toast({ title: 'Materialization Failed', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Materialize Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="w-full space-y-6 text-slate-900 dark:text-slate-100">
      {/* Workspace Top Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <span>Catalog Workspace</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              v1.5 Full-Screen Management
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Real-time management of Capabilities, Roles, Courses, Versions, Mappings, and Asset Assignability
          </p>
        </div>
        <div className="flex gap-2">
          {courses.filter(c => c.sourceType === 'level').length > 0 && (
            <button
              onClick={handleBatchMaterialize}
              className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Materialize All Levels ({courses.filter(c => c.sourceType === 'level').length})</span>
            </button>
          )}
          <button
            onClick={refreshAll}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Cards Row (7 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Capabilities</p>
          <p className="text-2xl font-extrabold text-blue-600 mt-1">{summary?.capabilitiesCount ?? 0}</p>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Roles</p>
          <p className="text-2xl font-extrabold text-purple-600 mt-1">{summary?.rolesCount ?? 0}</p>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Catalog Rows</p>
          <p className="text-2xl font-extrabold text-indigo-600 mt-1">{summary?.coursesLogicalCount ?? 0}</p>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Published Courses</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{summary?.publishedCoursesCount ?? 0}</p>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Assignable Courses</p>
          <p className="text-2xl font-extrabold text-teal-600 mt-1">{summary?.assignableCoursesCount ?? 0}</p>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Needs Review</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">{summary?.needsReviewCount ?? 0}</p>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Course Versions</p>
          <p className="text-2xl font-extrabold text-slate-600 mt-1">{summary?.optionalVersionsCount ?? 0}</p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit max-w-full border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'courses'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Courses Catalog ({courses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('capabilities')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'capabilities'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Capabilities ({capabilities.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'roles'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Roles ({roles.length})</span>
        </button>
      </div>
      <p className="-mt-4 text-xs text-slate-500 dark:text-slate-400">
        {activeTab === 'courses' && (
          <>
            Courses are loaded only from the canonical courses table. Upload snapshots and ingested levels are not used as display fallbacks.
          </>
        )}
        {activeTab === 'capabilities' && 'Capabilities are skills or knowledge areas that courses develop; they are not courses.'}
        {activeTab === 'roles' && 'Roles group the capabilities expected for a job; they are not courses.'}
      </p>

      {/* COURSES TAB CONTENT */}
      {activeTab === 'courses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Courses List Table */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Courses List</h3>
            <p className="mb-3 mt-1 text-xs text-slate-500">Select a row for details. Only Published Course records support draft editing here.</p>
            <div className="space-y-3 md:hidden">
              {courses.map((crs) => (
                <article key={`mobile:${crs.rowKey}`} onClick={() => handleSelectCourse(crs)} className={`rounded-xl border p-3 ${selectedCourse?.rowKey === crs.rowKey ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="font-bold text-indigo-600 dark:text-indigo-400">{crs.course_code}</p><p className="mt-0.5 truncate text-xs font-medium text-slate-700 dark:text-slate-200">{crs.course_name}</p></div>
                    <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold ${crs.sourceType === 'course' ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : crs.sourceType === 'level' ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}>{crs.sourceType === 'course' ? 'Published Course' : crs.sourceType === 'level' ? 'Ingested Level' : 'Upload Draft'}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300"><span>Version: {crs.publishedVersionNo ? `V${crs.publishedVersionNo}` : 'None'}</span><span>{crs.assignableStatus === 'ASSIGNABLE' ? 'Assignable' : crs.sourceType === 'course' ? 'Pending assets' : 'Not materialized'}</span><span>Status: {crs.lifecycle_status}</span></div>
                  <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800" onClick={(event) => event.stopPropagation()}>
                    {crs.sourceType === 'course' ? (
                      <div className="flex flex-wrap gap-2"><button onClick={() => handleOpenDraft(crs)} className="rounded border border-indigo-200 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:border-indigo-800 dark:text-indigo-300">Edit draft</button><button onClick={() => { setSelectedCourse(crs); handleSelectCourse(crs); setRollbackCourse(crs); setIsRollbackModalOpen(true); }} className="rounded border border-purple-200 px-2.5 py-1 text-[11px] font-semibold text-purple-700 dark:border-purple-800 dark:text-purple-300">Rollback</button><button onClick={() => handleRetireReactivate(crs)} className="rounded border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 dark:border-red-900 dark:text-red-300">{crs.lifecycle_status === 'RETIRED' ? 'Reactivate' : 'Retire'}</button></div>
                    ) : crs.sourceType === 'level' ? (
                      <button onClick={() => handleMaterialize(crs)} className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Materialize to Course</button>
                    ) : <p className="text-[11px] text-slate-600 dark:text-slate-300">Edit in Mapping & Review.</p>}
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-xs text-left text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b">
                  <tr>
                    <th className="p-2.5">Course Code</th>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Source</th>
                    <th className="p-2.5">Published Ver</th>
                    <th className="p-2.5">Assignable</th>
                    <th className="p-2.5">Lifecycle</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {courses.map((crs) => (
                    <React.Fragment key={crs.rowKey || `${crs.sourceType}:${crs.id}:${crs.course_code}`}>
                    <tr
                      onClick={() => handleSelectCourse(crs)}
                      className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        selectedCourse?.rowKey === crs.rowKey ? 'bg-indigo-50/70 dark:bg-indigo-950/40' : ''
                      }`}
                    >
                      <td className="p-2.5 font-bold text-indigo-600 dark:text-indigo-400">{crs.course_code}</td>
                      <td className="p-2.5 font-medium">{crs.course_name}</td>
                      <td className="p-2.5"><span className={`whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-semibold ${crs.sourceType === 'course' ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : crs.sourceType === 'level' ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}>{crs.sourceType === 'course' ? 'Published Course' : crs.sourceType === 'level' ? 'Ingested Level' : 'Upload Draft'}</span></td>
                      <td className="p-2.5">
                        {crs.publishedVersionNo ? (
                          <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            V{crs.publishedVersionNo}
                          </span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        {crs.assignableStatus === 'ASSIGNABLE' ? (
                          <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-teal-600 text-white">
                            Assignable
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-100 text-amber-800">
                            {crs.sourceType === 'course' ? 'Pending Assets' : 'Not materialized'}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                            crs.lifecycle_status === 'RETIRED'
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : crs.lifecycle_status === 'ACTIVE' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {crs.lifecycle_status}
                        </span>
                      </td>
                      <td className="p-2.5 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                        {crs.sourceType === 'level' ? (
                          <button
                            onClick={() => handleMaterialize(crs)}
                            className="px-2.5 py-1 rounded border border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                            title="Create course record from this published level"
                          >
                            Materialize
                          </button>
                        ) : (
                          <>
                            <button
                              disabled={crs.sourceType !== 'course'}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 disabled:cursor-not-allowed disabled:text-slate-300 dark:disabled:text-slate-700"
                              title={crs.sourceType === 'course' ? 'Edit draft' : crs.sourceType === 'upload' ? 'Edit this in Mapping & Review' : 'Materialize this level first'}
                              onClick={() => handleOpenDraft(crs)}
                              aria-label={crs.sourceType === 'course' ? `Edit ${crs.course_code}` : crs.sourceType === 'upload' ? `${crs.course_code} is editable in Mapping and Review` : `${crs.course_code} must be materialized first`}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={crs.sourceType !== 'course'}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-purple-600 disabled:cursor-not-allowed disabled:text-slate-300"
                              title={crs.sourceType === 'course' ? 'Rollback version' : 'Rollback is available after materialization'}
                              aria-label={crs.sourceType === 'course' ? `Rollback ${crs.course_code}` : `Rollback unavailable until ${crs.course_code} is materialized`}
                              onClick={() => {
                                setSelectedCourse(crs);
                                handleSelectCourse(crs);
                                setRollbackCourse(crs);
                                setIsRollbackModalOpen(true);
                              }}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={crs.sourceType !== 'course'}
                              className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                crs.sourceType !== 'course' ? 'cursor-not-allowed text-slate-300' : crs.lifecycle_status === 'RETIRED' ? 'text-green-600' : 'text-red-500'
                              }`}
                              title={crs.sourceType !== 'course' ? 'Lifecycle actions are available for published courses only' : crs.lifecycle_status === 'RETIRED' ? 'Reactivate' : 'Retire'}
                              aria-label={crs.sourceType === 'course' ? `${crs.lifecycle_status === 'RETIRED' ? 'Reactivate' : 'Retire'} ${crs.course_code}` : `Lifecycle actions unavailable until ${crs.course_code} is materialized`}
                              onClick={() => handleRetireReactivate(crs)}
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {crs.sourceType !== 'course' && selectedCourse?.rowKey === crs.rowKey && (
                      <tr className="bg-slate-50 dark:bg-slate-800/40"><td colSpan={7} className="px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300">{crs.sourceType === 'upload' ? 'Edit this record in Mapping & Review.' : 'Click "Materialize" to create a course record from this published level, then you can edit, manage versions, and view full content.'}</td></tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Course Detail & Versions Inspector */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>Course Detail Inspector</span>
              {selectedCourse && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded border border-indigo-200 text-indigo-600">
                  {selectedCourse.course_code}
                </span>
              )}
            </h3>

            {selectedCourse && courseDetail ? (
              <div className="space-y-4 text-xs">
                {courseDetail.sourceType === 'level' && (
                  <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <p className="font-bold text-sm mb-2">📋 Action Required: Materialize This Level</p>
                    <p className="text-xs mb-3">{courseDetail.sourceMessage}</p>
                    <button 
                      onClick={() => handleMaterialize(selectedCourse)}
                      className="w-full px-3 py-2 rounded-lg border-2 border-emerald-600 bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
                    >
                      ✨ Materialize Now
                    </button>
                  </div>
                )}

                {courseDetail.sourceType === 'upload' && courseDetail.sourceMessage && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{courseDetail.sourceMessage}</div>
                )}

                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-1">
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{courseDetail.course.course_name}</p>
                  <p className="text-slate-500">ID: {courseDetail.course.id}</p>
                  <p className="text-slate-500">Lifecycle Status: {courseDetail.course.lifecycle_status || 'ACTIVE'}</p>
                </div>

                {!courseDetail.sourceType && courseDetail.sourceMessage && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{courseDetail.sourceMessage}</div>
                )}

                {/* Versions History List */}
                <div>
                  <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-purple-600" />
                    <span>{courseDetail.sourceType ? 'Course Version History — available after materialization' : `Course Version History (${courseDetail.versions?.length || 0})`}</span>
                  </h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {courseDetail.versions?.map((v: any) => (
                      <div
                        key={v.id}
                        className="p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-purple-700 dark:text-purple-300">Version {v.version_no}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800">
                              {v.status}
                            </span>
                            {v.id === courseDetail.course.current_published_version_id && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 text-white">
                                Current Published
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {v.change_reason || 'Published update'} • {new Date(v.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">Select a course to inspect details and versions.</div>
            )}
          </div>
        </div>
      )}

      {/* CAPABILITIES TAB CONTENT */}
      {activeTab === 'capabilities' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Capabilities & Coverage Status</h3>
          <table className="w-full text-xs text-left text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b">
              <tr>
                <th className="p-2.5">Capability Code</th>
                <th className="p-2.5">Name</th>
                <th className="p-2.5">Actual Courses</th>
                <th className="p-2.5">Planned Courses</th>
                <th className="p-2.5">Coverage Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {capabilities.map((cap) => (
                <tr key={cap.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-2.5 font-bold text-blue-600">{cap.code}</td>
                  <td className="p-2.5">{cap.name}</td>
                  <td className="p-2.5 font-semibold">{cap.actualCourseCount}</td>
                  <td className="p-2.5 font-semibold">{cap.plannedCourseCount !== null ? cap.plannedCourseCount : 'N/A'}</td>
                  <td className="p-2.5">
                    <span
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                        cap.coverageStatus === 'COMPLETE'
                          ? 'bg-emerald-600 text-white'
                          : cap.coverageStatus === 'PARTIAL'
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {cap.coverageStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ROLES TAB CONTENT */}
      {activeTab === 'roles' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Roles & Mapped Capabilities</h3>
          <table className="w-full text-xs text-left text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b">
              <tr>
                <th className="p-2.5">Role Name / Code</th>
                <th className="p-2.5">Active Capabilities Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {roles.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-2.5 font-bold text-purple-600">{r.name || r.code}</td>
                  <td className="p-2.5 font-semibold">{r.activeCapabilityCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <DraftEditorModal
        isOpen={isDraftModalOpen}
        onClose={() => setIsDraftModalOpen(false)}
        draft={activeDraft}
        onDraftSaved={refreshAll}
      />

      <FullCourseContentEditor
        isOpen={isFullEditorOpen}
        onClose={() => {
          setIsFullEditorOpen(false);
          setEditingCourseId(null);
        }}
        courseId={editingCourseId || ''}
        onSaved={refreshAll}
      />

      <RollbackModal
        isOpen={isRollbackModalOpen}
        onClose={() => setIsRollbackModalOpen(false)}
        course={rollbackCourse}
        versions={courseDetail?.versions || []}
        onRollbackComplete={refreshAll}
      />
    </div>
  );
};
