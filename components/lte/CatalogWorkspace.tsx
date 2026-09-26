'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Briefcase,
  BookOpen,
  GitBranch,
  RotateCcw,
  Edit,
  RefreshCw,
  Eye,
  Download,
  CheckCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
  const [capabilitiesLoading, setCapabilitiesLoading] = useState<boolean>(false);
  const [capabilitiesPage, setCapabilitiesPage] = useState<number>(1);
  const [capabilitiesPagination, setCapabilitiesPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [rolesLoading, setRolesLoading] = useState<boolean>(false);
  const [rolesPage, setRolesPage] = useState<number>(1);
  const [rolesPagination, setRolesPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [isFullEditorOpen, setIsFullEditorOpen] = useState<boolean>(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState<boolean>(false);
  const [rollbackCourse, setRollbackCourse] = useState<any>(null);
  const [publishConfirmCourse, setPublishConfirmCourse] = useState<any>(null);
  const [publishingCourseId, setPublishingCourseId] = useState<string | null>(null);

  const { toast } = useToast();

  const refreshAll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lte/workspace?view=dashboard', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load catalog workspace');
      setSummary(data.summary);
      setCapabilities(data.capabilities || []);
      setCapabilitiesPagination((prev) => ({
        ...prev,
        page: 1,
        total: data.summary?.capabilitiesCount || data.capabilities?.length || 0,
        totalPages: Math.max(Math.ceil((data.summary?.capabilitiesCount || data.capabilities?.length || 0) / prev.limit), 1),
        hasNextPage: (data.summary?.capabilitiesCount || data.capabilities?.length || 0) > prev.limit,
        hasPreviousPage: false,
      }));
      setRoles(data.roles || []);
      setRolesPagination((prev) => ({
        ...prev,
        page: 1,
        total: data.summary?.rolesCount || data.roles?.length || 0,
        totalPages: Math.max(Math.ceil((data.summary?.rolesCount || data.roles?.length || 0) / prev.limit), 1),
        hasNextPage: (data.summary?.rolesCount || data.roles?.length || 0) > prev.limit,
        hasPreviousPage: false,
      }));
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

  const loadCapabilitiesPage = async (page: number) => {
    setCapabilitiesLoading(true);
    try {
      const params = new URLSearchParams({ view: 'capabilities', page: String(page), limit: String(capabilitiesPagination.limit) });
      const res = await fetch(`/api/admin/lte/workspace?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load capabilities');
      setCapabilities(data.capabilities || []);
      setCapabilitiesPagination(data.pagination || capabilitiesPagination);
      setCapabilitiesPage(data.pagination?.page || page);
    } catch (error: any) {
      toast({ title: 'Capabilities Load Failed', description: error.message, variant: 'destructive' });
    } finally {
      setCapabilitiesLoading(false);
    }
  };

  const loadRolesPage = async (page: number) => {
    setRolesLoading(true);
    try {
      const params = new URLSearchParams({ view: 'roles', page: String(page), limit: String(rolesPagination.limit) });
      const res = await fetch(`/api/admin/lte/workspace?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load roles');
      setRoles(data.roles || []);
      setRolesPagination(data.pagination || rolesPagination);
      setRolesPage(data.pagination?.page || page);
    } catch (error: any) {
      toast({ title: 'Roles Load Failed', description: error.message, variant: 'destructive' });
    } finally {
      setRolesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'capabilities') {
      loadCapabilitiesPage(capabilitiesPage);
    }
    if (activeTab === 'roles') {
      loadRolesPage(rolesPage);
    }
  }, [activeTab]);

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

    setEditingCourseId(course.id);
    setIsFullEditorOpen(true);
  };

  const openPublishConfirm = (course: any) => {
    if (!course || course.sourceType !== 'course') return;
    setPublishConfirmCourse(course);
  };

  const handlePublishCourse = async (course: any) => {
    if (!course || course.sourceType !== 'course') return;

    try {
      setPublishingCourseId(course.id);
      const res = await fetch('/api/admin/lte/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PUBLISH_COURSE_LEVEL', courseId: course.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to publish course');

      toast({ title: 'Course Published', description: `${course.course_code} is now assignable.` });
      await refreshAll();
      if (selectedCourse?.id === course.id) {
        await handleSelectCourse({ ...course, assignableStatus: 'ASSIGNABLE', lifecycle_status: data.lifecycleStatus || course.lifecycle_status });
      }
      setPublishConfirmCourse(null);
    } catch (error: any) {
      toast({ title: 'Publish Failed', description: error.message, variant: 'destructive' });
    } finally {
      setPublishingCourseId(null);
    }
  };
  const handleViewCourse = (course: any) => {
    if (!course) return;
    setSelectedCourse(course);
    handleSelectCourse(course);
    if (course.sourceType === 'course') {
      setEditingCourseId(course.id);
      setIsFullEditorOpen(true);
    }
  };

  const mappedCapabilities = selectedCourse && courseDetail?.mappedCapabilities
    ? courseDetail.mappedCapabilities
    : [];
  const mappedRoles = selectedCourse && courseDetail?.mappedRoles
    ? courseDetail.mappedRoles
    : [];

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
            Real-time management of Capabilities, Roles, Course Levels, and Catalog Versions
          </p>
        </div>
        <div className="flex gap-2">
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
          <span>Capabilities ({summary?.capabilitiesCount ?? capabilities.length})</span>
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
          <span>Roles ({summary?.rolesCount ?? roles.length})</span>
        </button>
      </div>
      <p className="-mt-4 text-xs text-slate-500 dark:text-slate-400">
        {activeTab === 'courses' && (
          <>
            Existing levels are the canonical course records; versions are tracked through catalog_versions.
          </>
        )}
        {activeTab === 'capabilities' && 'Capabilities with L1–L5 ingestion progress. Mapped capability for the selected course is shown in the Course Detail Inspector.'}
        {activeTab === 'roles' && 'Roles with mapped capability counts. Roles for the selected course are shown in the Course Detail Inspector.'}
      </p>

      {/* COURSES TAB CONTENT */}
      {activeTab === 'courses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Courses List Table */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Courses List</h3>
            <p className="mb-3 mt-1 text-xs text-slate-500">Select a row for details. Only Published Course records support draft editing here.</p>
            <div className="space-y-3 md:hidden">
              {courses.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No catalog courses yet</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Upload and publish a workbook to create course rows here.</p>
                </div>
              )}
              {courses.map((crs) => (
                <article key={`mobile:${crs.rowKey}`} onClick={() => handleSelectCourse(crs)} className={`rounded-xl border p-3 ${selectedCourse?.rowKey === crs.rowKey ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="font-bold text-indigo-600 dark:text-indigo-400">{crs.course_code}</p><p className="mt-0.5 truncate text-xs font-medium text-slate-700 dark:text-slate-200">{crs.course_name}</p></div>
                    <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold ${crs.sourceType === 'course' ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}>{crs.sourceType === 'course' ? 'Catalog Course' : 'Upload Draft'}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300"><span>Version: {crs.publishedVersionNo ? `V${crs.publishedVersionNo}` : 'None'}</span><span>{crs.assignableStatus === 'ASSIGNABLE' ? 'Assignable' : 'Not assignable'}</span><span>Status: {crs.lifecycle_status}</span></div>
                  <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800" onClick={(event) => event.stopPropagation()}>
                    {crs.sourceType === 'course' ? (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleViewCourse(crs)} className="flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50/60 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                          <Eye className="h-3 w-3" /> View content
                        </button>
                                                {crs.assignableStatus !== 'ASSIGNABLE' && (
                          <button onClick={() => openPublishConfirm(crs)} className="flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <CheckCircle className="h-3 w-3" /> Publish
                          </button>
                        )}
                        <button onClick={() => handleOpenDraft(crs)} className="rounded border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">Edit draft</button>
                      </div>
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
                  {courses.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="mx-auto max-w-sm">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No catalog courses yet</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Upload and publish a workbook to create course rows here.</p>
                        </div>
                      </td>
                    </tr>
                  )}
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
                      <td className="p-2.5"><span className={`whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-semibold ${crs.sourceType === 'course' ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}>{crs.sourceType === 'course' ? 'Catalog Course' : 'Upload Draft'}</span></td>
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
                            Not assignable
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
                      <td className="p-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                            <button
                              disabled={crs.sourceType !== 'course'}
                              className="p-1 rounded text-indigo-600 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:text-slate-300 dark:text-indigo-400 dark:hover:bg-indigo-950/50 dark:disabled:text-slate-700"
                              title={crs.sourceType === 'course' ? 'View full course content & 6E stages' : 'Open after publish'}
                              onClick={() => handleViewCourse(crs)}
                              aria-label={crs.sourceType === 'course' ? `View content for ${crs.course_code}` : `View content unavailable until ${crs.course_code} is published`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {crs.sourceType === 'course' && crs.assignableStatus !== 'ASSIGNABLE' && (
                              <button
                                className="p-1 rounded text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                                title="Publish course level"
                                onClick={() => openPublishConfirm(crs)}
                                aria-label={`Publish ${crs.course_code}`}
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              disabled={crs.sourceType !== 'course'}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300 dark:text-slate-400 dark:disabled:text-slate-700"
                              title={crs.sourceType === 'course' ? 'Edit draft' : 'Edit this in Mapping & Review'}
                              onClick={() => handleOpenDraft(crs)}
                              aria-label={crs.sourceType === 'course' ? `Edit ${crs.course_code}` : `${crs.course_code} is editable in Mapping and Review`}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                      </td>
                    </tr>
                    {crs.sourceType !== 'course' && selectedCourse?.rowKey === crs.rowKey && (
                      <tr className="bg-slate-50 dark:bg-slate-800/40"><td colSpan={7} className="px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300">{crs.sourceType === 'upload' ? 'Edit this record in Mapping & Review.' : 'This record is managed directly from the existing levels catalog.'}</td></tr>
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
                {courseDetail.sourceType === 'upload' && courseDetail.sourceMessage && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{courseDetail.sourceMessage}</div>
                )}

                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-1">
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{courseDetail.course.course_name}</p>
                  <p className="text-slate-500">ID: {courseDetail.course.id}</p>
                  <p className="text-slate-500">Lifecycle Status: {courseDetail.course.lifecycle_status || 'ACTIVE'}</p>
                  <p className="text-slate-500">
                    Asset readiness:{' '}
                    <span className={courseDetail.assetStatus === 'staged' || courseDetail.assetStatus === 'none' ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                      {courseDetail.assetStatus === 'staged' ? `Verified (${courseDetail.sourceAssets?.length || 0} assets)` : courseDetail.assetStatus === 'none' ? 'No linked assets' : 'Pending'}
                    </span>
                  </p>
                  {selectedCourse?.sourceType === 'course' && (
                    <div className="flex gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                      <button
                        onClick={() => handleViewCourse(selectedCourse)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:from-indigo-700 hover:to-purple-700"
                        title="View full course structure, 6E stages, artifacts, and content"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Course Content</span>
                      </button>
                                            {selectedCourse.assignableStatus !== 'ASSIGNABLE' && (
                        <button
                          onClick={() => openPublishConfirm(selectedCourse)}
                          className="flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          title="Publish course level"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Publish</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenDraft(selectedCourse)}
                        className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        title="Edit course draft"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                  )}
                </div>

                {!courseDetail.sourceType && courseDetail.sourceMessage && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{courseDetail.sourceMessage}</div>
                )}

                {/* Versions History List */}
                <div>
                  <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-purple-600" />
                    <span>{courseDetail.sourceType ? 'Course Version History — available after materialization' : `Course Version History (${courseDetail.versions?.length || 0})`}</span>
                    {courseDetail.versions?.some((v: any) => v.status === 'PUBLISHED') && (
                      <button
                        type="button"
                        onClick={() => {
                          setRollbackCourse(selectedCourse);
                          setIsRollbackModalOpen(true);
                        }}
                        className="ml-auto inline-flex items-center gap-1 rounded border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore version
                      </button>
                    )}
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
                        {v.status === 'PUBLISHED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setRollbackCourse(selectedCourse);
                              setIsRollbackModalOpen(true);
                            }}
                            className="rounded border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    ))}
                    {(!courseDetail.versions || courseDetail.versions.length === 0) && (
                      <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-[11px] text-slate-500 dark:border-slate-700">
                        Publish this course again to create version history.
                      </div>
                    )}
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
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Capabilities & Level Progression (L1 - L5)</h3>
              <p className="text-xs text-slate-500">
                Track level ingestion progress. Click any level badge (e.g. L2) to download a pre-filled Excel template for that capability level.
                {selectedCourse ? ` Selected course maps to ${selectedCourse.course_code}.` : ''}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b">
                <tr>
                  <th className="p-2.5 whitespace-nowrap">Capability Code</th>
                  <th className="p-2.5">Name</th>
                  <th className="p-2.5 whitespace-nowrap">Level Coverage (L1 - L5)</th>
                  <th className="p-2.5 whitespace-nowrap">Ingested / Total</th>
                  <th className="p-2.5 whitespace-nowrap">Coverage Status</th>
                  <th className="p-2.5 text-right whitespace-nowrap">Download Pre-filled Template</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {capabilitiesLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-xs text-slate-500">Loading capabilities…</td>
                  </tr>
                )}
                {!capabilitiesLoading && capabilities.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No capabilities found</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Upload a workbook to populate the catalog.</p>
                    </td>
                  </tr>
                )}
                {!capabilitiesLoading && capabilities.map((cap: any) => {
                  const levels = cap.levelsBreakdown || [1, 2, 3, 4, 5].map((levelNo: number) => ({
                    levelNo,
                    label: `L${levelNo}`,
                    status: (cap.actualCourseCount || 0) >= levelNo ? 'PUBLISHED' : 'PENDING',
                  }));
                  const completed = cap.completedLevelsCount ?? levels.filter((l: any) => l.status !== 'PENDING').length;
                  const total = cap.totalLevelsCount || 5;
                  const percent = Math.round((completed / total) * 100);
                  const nextPending = levels.find((l: any) => l.status === 'PENDING') || levels[0];
                  return (
                    <tr key={cap.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-2.5 font-bold text-indigo-600 dark:text-indigo-400">{cap.code}</td>
                      <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{cap.name}</td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {levels.map((lvl: any) => {
                            const isPub = lvl.status === 'PUBLISHED';
                            const isIng = lvl.status === 'INGESTED';
                            return (
                              <a
                                key={lvl.levelNo}
                                href={`/api/admin/lte/template?capabilityCode=${encodeURIComponent(cap.code)}&levelNo=${lvl.levelNo}`}
                                download={`LTE_${cap.code}_L${lvl.levelNo}_Template.xlsx`}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer hover:scale-105 ${
                                  isPub
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                                    : isIng
                                    ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 hover:bg-blue-100'
                                    : 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-100'
                                }`}
                                title={`Download pre-filled Excel template for ${cap.code} Level ${lvl.levelNo}`}
                              >
                                <span>{isPub ? `✓ ${lvl.label}` : isIng ? `• ${lvl.label}` : `${lvl.label}`}</span>
                                <Download className="w-2.5 h-2.5 opacity-70" />
                              </a>
                            );
                          })}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <div className="space-y-1 w-28">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-slate-700 dark:text-slate-300">{completed} / {total} Levels</span>
                            <span className="text-indigo-600 dark:text-indigo-400">{percent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-full whitespace-nowrap ${completed === 5 ? 'bg-emerald-600 text-white' : completed > 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {completed === 5 ? 'COMPLETE (L1–L5)' : completed > 0 ? `PARTIAL (${completed}/5)` : 'NOT STARTED'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        <a
                          href={`/api/admin/lte/template?capabilityCode=${encodeURIComponent(cap.code)}&levelNo=${nextPending.levelNo}`}
                          download={`LTE_${cap.code}_L${nextPending.levelNo}_Template.xlsx`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 shadow-2xs transition-colors"
                          title={`Download pre-filled Excel template to create ${cap.code} Level ${nextPending.levelNo}`}
                        >
                          <Download className="w-3 h-3" />
                          <span>L{nextPending.levelNo} Template</span>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Page {capabilitiesPagination.page} of {capabilitiesPagination.totalPages} ({capabilitiesPagination.total} total)</span>
            <div className="flex gap-2">
              <button disabled={!capabilitiesPagination.hasPreviousPage || capabilitiesLoading} onClick={() => loadCapabilitiesPage(capabilitiesPage - 1)} className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-50">Previous</button>
              <button disabled={!capabilitiesPagination.hasNextPage || capabilitiesLoading} onClick={() => loadCapabilitiesPage(capabilitiesPage + 1)} className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-50">Next</button>
            </div>
          </div>
          {selectedCourse && mappedCapabilities.length > 0 && (
            <p className="text-[11px] text-slate-500">Selected course {selectedCourse.course_code} maps to {mappedCapabilities[0]?.code}.</p>
          )}
        </div>
      )}

      {/* ROLES TAB CONTENT */}
      {activeTab === 'roles' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Roles & Mapped Capabilities</h3>
              <p className="mt-1 text-xs text-slate-500">
                Full role list with capability counts.
                {selectedCourse ? ` Selected course maps to ${mappedRoles.length} role(s).` : ''}
              </p>
            </div>
          </div>
          <table className="w-full text-xs text-left text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b">
              <tr>
                <th className="p-2.5">Role Name / Code</th>
                <th className="p-2.5">Active Capabilities Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rolesLoading && (
                <tr>
                  <td colSpan={2} className="px-4 py-12 text-center text-xs text-slate-500">Loading roles…</td>
                </tr>
              )}
              {!rolesLoading && roles.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-12 text-center">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No roles found</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Roles populate from the reference tables.</p>
                  </td>
                </tr>
              )}
              {!rolesLoading && roles.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-2.5 font-bold text-purple-600">{r.name || r.code}</td>
                  <td className="p-2.5 font-semibold">{r.activeCapabilityCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>Page {rolesPagination.page} of {rolesPagination.totalPages} ({rolesPagination.total} total)</span>
            <div className="flex gap-2">
              <button disabled={!rolesPagination.hasPreviousPage || rolesLoading} onClick={() => loadRolesPage(rolesPage - 1)} className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-50">Previous</button>
              <button disabled={!rolesPagination.hasNextPage || rolesLoading} onClick={() => loadRolesPage(rolesPage + 1)} className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      )}

      <FullCourseContentEditor
        isOpen={isFullEditorOpen}
        onClose={() => {
          setIsFullEditorOpen(false);
          setEditingCourseId(null);
        }}
        courseId={editingCourseId || ''}
        onSaved={refreshAll}
      />

      {publishConfirmCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="publish-course-title">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="publish-course-title" className="text-base font-bold text-slate-900 dark:text-slate-100">Publish course level?</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  This will publish {publishConfirmCourse.course_code} and make it assignable in the learner catalog.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/40">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{publishConfirmCourse.course_name}</p>
              <p className="mt-1 text-slate-500 dark:text-slate-400">Version: {publishConfirmCourse.publishedVersionNo ? `V${publishConfirmCourse.publishedVersionNo}` : 'None'} | Status: {publishConfirmCourse.lifecycle_status}</p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={publishingCourseId === publishConfirmCourse.id}
                onClick={() => setPublishConfirmCourse(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={publishingCourseId === publishConfirmCourse.id}
                onClick={() => handlePublishCourse(publishConfirmCourse)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70"
              >
                <CheckCircle className="h-4 w-4" />
                {publishingCourseId === publishConfirmCourse.id ? 'Publishing...' : 'Confirm Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
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
