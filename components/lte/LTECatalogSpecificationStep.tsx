'use client';

import React, { useState } from 'react';
import { ArrowLeft, Eye, UploadCloud, CheckCircle, Loader2 } from 'lucide-react';
import Logger from '@/lib/logger';
import { LTECourseMetadata, LTEIngestionSnapshot, LTELevelCourse, LTEModule } from '@/types/lte-ingestion';

const logger = new Logger('LTECatalogSpecificationStep');

interface LTECatalogSpecificationStepProps {
  snapshot: LTEIngestionSnapshot | null;
  onBack: () => void;
  onOpenLearnerPreview: (course: LTELevelCourse) => void;
  onPublishCourse: (metadata: LTECourseMetadata) => Promise<void>;
  publishing: boolean;
}

export const LTECatalogSpecificationStep: React.FC<LTECatalogSpecificationStepProps> = ({
  snapshot,
  onBack,
  onOpenLearnerPreview,
  onPublishCourse,
  publishing,
}) => {
  const [selectedLevelIndex, setSelectedLevelIndex] = useState<number>(0);
  const [levelCourses, setLevelCourses] = useState<LTELevelCourse[]>(() => {
    if (snapshot?.levelCourses && snapshot.levelCourses.length > 0) {
      return snapshot.levelCourses;
    }
    
    const baseMeta: LTECourseMetadata = snapshot?.courseMetadata || {
      courseTitle: '',
      courseCode: '',
      domain: '',
      capabilityCode: '',
      capabilityLevel: '',
      instructorLead: '',
      courseSummary: '',
      problemStatement: '',
      capstoneTitle: '',
    };

    return [{
      levelCode: baseMeta.capabilityLevel || 'Course 1',
      levelNo: 1,
      levelName: baseMeta.capabilityLevel || 'Uploaded Course',
      courseMetadata: baseMeta,
      modules: snapshot?.modules || [],
    }];
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [published, setPublished] = useState<boolean>(false);

  // Sync snapshot changes into levelCourses state
  React.useEffect(() => {
    if (snapshot?.levelCourses && snapshot.levelCourses.length > 0) {
      setLevelCourses(snapshot.levelCourses);
      setSelectedLevelIndex(0);
    }
    setPublished(snapshot?.status === 'published');
  }, [snapshot]);

  // Load review data when component mounts or snapshot changes
  React.useEffect(() => {
    if (snapshot?.uploadId) {
      loadReviewData();
    }
  }, [snapshot?.uploadId]);

  const loadReviewData = async () => {
    if (!snapshot?.uploadId) return;

    setLoading(true);
    setError(null);
    logger.info('Loading review data', { uploadId: snapshot.uploadId });

    try {
      const res = await fetch(`/api/admin/lte/review?uploadId=${snapshot.uploadId}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load review data');
      }

      logger.info('Review data loaded successfully');
      
      if (data.levelCourses && data.levelCourses.length > 0) {
        setLevelCourses(data.levelCourses);
      } else if (data.courseSpecification) {
        // Single specification fallback
        setLevelCourses((prev) => {
          const updated = [...prev];
          if (updated[0]) {
            updated[0] = {
              ...updated[0],
              courseMetadata: {
                courseTitle: data.courseSpecification.courseTitle || '',
                courseCode: data.courseSpecification.courseCode || '',
                domain: data.courseSpecification.domain || '',
                capabilityCode: data.courseSpecification.capabilityCode || '',
                capabilityLevel: data.courseSpecification.capabilityLevel?.toString() || 'Level 1',
                instructorLead: data.courseSpecification.instructorLead || '',
                courseSummary: data.courseSpecification.courseSummary || '',
                problemStatement: data.courseSpecification.problemStatement || '',
                capstoneTitle: data.courseSpecification.capstoneArtifactTitle || '',
              },
              modules: data.modules || updated[0].modules,
            };
          }
          return updated;
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to load review data', { error: msg });
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const activeCourse = levelCourses[selectedLevelIndex] || levelCourses[0];
  const formData = activeCourse?.courseMetadata || {
    courseTitle: '',
    courseCode: '',
    domain: '',
    capabilityCode: '',
    capabilityLevel: '',
    instructorLead: '',
    courseSummary: '',
    problemStatement: '',
    capstoneTitle: '',
  };

  const modules: LTEModule[] = activeCourse?.modules || [];
  
  // Sort modules by index (module_no) in ascending order
  const sortedModules = [...modules].sort((a, b) => a.index - b.index);

  const handleInputChange = (field: keyof LTECourseMetadata, value: string) => {
    setLevelCourses((prev) => {
      const copy = [...prev];
      if (copy[selectedLevelIndex]) {
        copy[selectedLevelIndex] = {
          ...copy[selectedLevelIndex],
          courseMetadata: {
            ...copy[selectedLevelIndex].courseMetadata,
            [field]: value,
          },
        };
      }
      return copy;
    });
  };

  const handleUploadClick = () => {
    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const handleConfirmPublish = async () => {
    setShowConfirmDialog(false);
    logger.info('Submitting course upload');
    try {
      await onPublishCourse(formData);
      setPublished(true);
    } catch {
      setPublished(false);
    }
  };

  const handleCancelPublish = () => {
    setShowConfirmDialog(false);
    logger.info('Publish cancelled by user');
  };

  return (
    <div className="w-full space-y-5">
      {/* Loading State */}
      {loading && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Loading course specification and modules...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-3">
            <span className="text-lg font-bold">⚠</span>
            <h3 className="text-base font-bold">Failed to Load Review Data</h3>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">{error}</p>
          <button
            onClick={loadReviewData}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Step 2 Form Container */}
      {!loading && !error && (
        <div className="bg-white dark:bg-slate-900 border border-[#d7e2ef] dark:border-slate-800 rounded-[18px] p-5 md:p-6 shadow-sm space-y-5">
          <h2 className="text-lg md:text-xl font-bold text-[#101c32] dark:text-slate-100 border-b border-[#dce6f2] dark:border-slate-800 pb-3">
            Course Catalog Specification & Capability Level Mapping
          </h2>

          {/* Capability Level Switcher Bar (L1...L5) */}
          <div className="bg-[#f6f9fd] dark:bg-slate-800/50 border border-[#dbe5f0] dark:border-slate-700/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2c466c] dark:text-slate-300 uppercase tracking-wider">
                Uploaded Courses ({levelCourses.length} Detected)
              </span>
              <span className="text-xs font-semibold text-[#7c3cff] dark:text-purple-400">
                Viewing: {activeCourse?.levelCode || `Course ${selectedLevelIndex + 1}`}
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {levelCourses.map((lc, idx) => {
                const isSelected = idx === selectedLevelIndex;
                return (
                  <button
                    key={lc.levelCode || idx}
                    type="button"
                    onClick={() => setSelectedLevelIndex(idx)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 shadow-2xs cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#315cf4] to-[#9828ef] text-white border-[#7745f6] shadow-md ring-2 ring-[#8b5cf6]/25'
                        : 'bg-[#fbfdff] dark:bg-slate-900 border-[#dbe5f0] dark:border-slate-700 text-[#2c466c] dark:text-slate-300 hover:border-[#a78bfa] dark:hover:border-purple-500'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-[#f1e8ff] dark:bg-purple-950 text-[#7c23e8] dark:text-purple-300'
                      }`}>
                        {lc.levelCode || `L${idx + 1}`}
                      </span>
                      <span className={`text-[10px] font-semibold ${
                        isSelected ? 'text-[#eee9ff]' : 'text-[#557094] dark:text-slate-400'
                      }`}>
                        {lc.modules.length} {lc.modules.length === 1 ? 'Module' : 'Modules'}
                      </span>
                    </div>
                    <span className={`text-xs font-bold truncate mt-0.5 ${
                      isSelected ? 'text-white' : 'text-[#101c32] dark:text-slate-100'
                    }`}>
                      {lc.courseMetadata.courseTitle || lc.levelName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Grid */}
          <div className="space-y-3.5">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Course Title
              </label>
              <input
                type="text"
                value={formData.courseTitle}
                onChange={(e) => handleInputChange('courseTitle', e.target.value)}
                className="w-full bg-[#f5f8fc] dark:bg-slate-800/80 border border-[#d5e1ef] dark:border-slate-700 rounded-[11px] px-3 py-2 text-xs md:text-sm font-medium text-[#172743] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7545ff]/40 focus:border-[#7545ff]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Course Code
              </label>
              <input
                type="text"
                value={formData.courseCode}
                onChange={(e) => handleInputChange('courseCode', e.target.value)}
                className="w-full bg-[#f5f8fc] dark:bg-slate-800/80 border border-[#d5e1ef] dark:border-slate-700 rounded-[11px] px-3 py-2 text-xs md:text-sm font-medium text-[#172743] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7545ff]/40 focus:border-[#7545ff] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Domain / Industry Field
              </label>
              <input
                type="text"
                value={formData.domain}
                onChange={(e) => handleInputChange('domain', e.target.value)}
                className="w-full bg-[#f5f8fc] dark:bg-slate-800/80 border border-[#d5e1ef] dark:border-slate-700 rounded-[11px] px-3 py-2 text-xs md:text-sm font-medium text-[#172743] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7545ff]/40 focus:border-[#7545ff]"
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Capability Code
              </label>
              <input
                type="text"
                value={formData.capabilityCode}
                onChange={(e) => handleInputChange('capabilityCode', e.target.value)}
                className="w-full bg-[#f5f8fc] dark:bg-slate-800/80 border border-[#d5e1ef] dark:border-slate-700 rounded-[11px] px-3 py-2 text-xs md:text-sm font-medium text-[#172743] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7545ff]/40 focus:border-[#7545ff]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Capability Level (1 to 5)
              </label>
              <input
                type="text"
                value={formData.capabilityLevel}
                onChange={(e) => handleInputChange('capabilityLevel', e.target.value)}
                className="w-full bg-[#f5f8fc] dark:bg-slate-800/80 border border-[#d5e1ef] dark:border-slate-700 rounded-[11px] px-3 py-2 text-xs md:text-sm font-medium text-[#172743] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7545ff]/40 focus:border-[#7545ff]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Assigned Instructor Lead
              </label>
              <input
                type="text"
                value={formData.instructorLead}
                onChange={(e) => handleInputChange('instructorLead', e.target.value)}
                className="w-full bg-[#f5f8fc] dark:bg-slate-800/80 border border-[#d5e1ef] dark:border-slate-700 rounded-[11px] px-3 py-2 text-xs md:text-sm font-medium text-[#172743] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7545ff]/40 focus:border-[#7545ff]"
              />
            </div>
          </div>

          {/* Row 3 Full width */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Course Summary / Overview
            </label>
            <textarea
              rows={2}
              value={formData.courseSummary}
              onChange={(e) => handleInputChange('courseSummary', e.target.value)}
              className="w-full bg-[#f5f8fc] dark:bg-slate-800/80 border border-[#d5e1ef] dark:border-slate-700 rounded-[11px] px-3 py-2 text-xs md:text-sm font-medium text-[#172743] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7545ff]/40 focus:border-[#7545ff] resize-none"
            />
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Problem Statement
              </label>
              <textarea
                rows={2}
                value={formData.problemStatement}
                onChange={(e) => handleInputChange('problemStatement', e.target.value)}
                className="w-full bg-[#f5f8fc] dark:bg-slate-800/80 border border-[#d5e1ef] dark:border-slate-700 rounded-[11px] px-3 py-2 text-xs md:text-sm font-medium text-[#172743] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7545ff]/40 focus:border-[#7545ff] resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Final Capstone Artifact Title
              </label>
              <textarea
                rows={2}
                value={formData.capstoneTitle}
                onChange={(e) => handleInputChange('capstoneTitle', e.target.value)}
                className="w-full bg-[#f5f8fc] dark:bg-slate-800/80 border border-[#d5e1ef] dark:border-slate-700 rounded-[11px] px-3 py-2 text-xs md:text-sm font-medium text-[#172743] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7545ff]/40 focus:border-[#7545ff] resize-none"
              />
            </div>
          </div>
        </div>

        {/* Module Curriculum Breakdown Section */}
        <div className="pt-4 border-t border-[#dce6f2] dark:border-slate-800 space-y-3.5">
          <div>
            <h3 className="text-xs font-bold text-[#516b91] dark:text-purple-400 tracking-wide uppercase">
              MODULE CURRICULUM BREAKDOWN (MODULES 0 TO {sortedModules.length - 1}) – TOTAL ({sortedModules.length})
            </h3>
            <p className="text-xs text-[#647b9c] dark:text-slate-400 mt-1.5">
              Each module includes the 6 Es Framework (Engage, Explore, Explain, Express, Empower, Evolve) + 2 Artifact Practices.
            </p>
          </div>

          {/* Module Card Component */}
            {sortedModules.map((mod) => (
            <div
              key={mod.index}
              className="bg-[#f4f8fd] dark:bg-slate-800/40 border border-[#d5e1ef] dark:border-slate-700/80 rounded-[14px] p-4 space-y-3"
            >
              {/* Module Header Pill */}
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#f1e8ff] dark:bg-purple-950 text-[#7c23e8] dark:text-purple-300 border border-[#e2ceff] dark:border-purple-800">
                  Module {mod.index}
                </span>
                <h4 className="min-w-0 rounded-full border border-[#cfdded] bg-white/80 px-4 py-1 text-sm font-bold text-[#101c32] dark:text-slate-100">
                  {mod.title}
                </h4>
              </div>

              {/* 6 Stage Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
                {mod.stages
                  .sort((a, b) => a.stageIndex - b.stageIndex)
                  .map((st) => {
                    let borderColor = 'border-purple-300 dark:border-purple-700 bg-purple-50/60 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200';
                    if (st.name === 'Explore')
                      borderColor = 'border-blue-300 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200';
                    if (st.name === 'Explain')
                      borderColor = 'border-cyan-300 dark:border-cyan-700 bg-cyan-50/60 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-200';
                    if (st.name === 'Express')
                      borderColor = 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200';
                    if (st.name === 'Empower')
                      borderColor = 'border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200';
                    if (st.name === 'Evolve')
                      borderColor = 'border-green-300 dark:border-green-700 bg-green-50/60 dark:bg-green-950/40 text-green-900 dark:text-green-200';

                    return (
                      <div
                        key={st.id}
                        className={`min-h-[58px] p-2 rounded-[10px] border text-left shadow-2xs ${borderColor}`}
                      >
                        <span className="text-[11px] font-bold block">{st.label}</span>
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 block truncate">
                          {st.subtitle}
                        </span>
                      </div>
                    );
                  })}
              </div>

              {/* 2 Artifact Practices Pills */}
              <div className="flex flex-wrap gap-2 pt-1">
                {mod.artifactPractices.map((art) => (
                  <span
                    key={art.id}
                    className="px-4 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-slate-900 border border-[#cfdded] dark:border-slate-700 text-[#2c466c] dark:text-slate-300 shadow-2xs"
                  >
                    {art.title}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {sortedModules.length === 0 && (
            <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No modules were linked to this uploaded course.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Check the modules sheet level_id, level_code, or level_no values for this course.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-[#dce6f2] dark:border-slate-800">
          <button
            onClick={onBack}
            className="w-full sm:w-auto px-5 py-2.5 rounded-[10px] border border-[#d5e1ef] bg-[#f7f9fc] dark:border-slate-700 text-[#172743] dark:text-slate-300 font-semibold text-xs md:text-sm hover:bg-[#eef3f9] dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => activeCourse && onOpenLearnerPreview(activeCourse)}
              disabled={!activeCourse}
              className="w-full sm:w-auto px-6 py-2.5 rounded-[10px] border border-[#d7e2ef] dark:border-purple-500 text-[#7435f5] dark:text-purple-300 font-bold text-xs md:text-sm hover:bg-[#f4efff] dark:hover:bg-purple-950/40 transition-all flex items-center justify-center gap-2 shadow-2xs"
            >
              <Eye className="w-4 h-4" />
              Verify in Learner View
            </button>

            <button
              onClick={handleUploadClick}
              disabled={publishing || published}
              className="w-full sm:w-auto px-8 py-2.5 rounded-[10px] bg-gradient-to-r from-[#315cf4] to-[#9828ef] hover:from-[#274ee0] hover:to-[#861fd8] text-white font-bold text-xs md:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {publishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Publishing Course...
                </>
              ) : published ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Published
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  Upload Course
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center shrink-0">
                <UploadCloud className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Confirm Course Publication
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  You are about to publish this course to the production catalog.
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Total Levels / Courses:</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">{levelCourses.length} Course{levelCourses.length === 1 ? '' : 's'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Active Course:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formData.courseTitle || 'Untitled'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Code:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formData.courseCode || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Active Level Modules:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{sortedModules.length}</span>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> This action will insert or skip records across all 13 catalog tables. The operation is transactional and cannot be undone from this interface.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button
                onClick={handleCancelPublish}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPublish}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Confirm & Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LTECatalogSpecificationStep;
