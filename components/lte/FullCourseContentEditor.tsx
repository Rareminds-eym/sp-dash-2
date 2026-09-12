'use client';

import React, { useState, useEffect } from 'react';
import { 
  Save, X, ChevronDown, ChevronRight, BookOpen, FileText, 
  CheckSquare, AlertCircle, Layers, HelpCircle, Video, 
  Music, File, ExternalLink, Award, Eye, Code, ListFilter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ArtifactQuestion {
  id?: string;
  question_order?: number;
  title?: string;
  description?: string;
  instructions?: string;
  is_active?: boolean;
  metadata?: any;
}

interface ArtifactTemplate {
  id?: string;
  file_name?: string;
  file_url?: string;
  file_type?: string;
  version?: number;
  is_downloadable?: boolean;
  metadata?: any;
}

interface Artifact {
  id: string;
  module_id?: string;
  artifact_title: string;
  artifact_type?: string;
  description?: string;
  instructions?: string;
  rubric_criteria?: any;
  total_score?: number;
  passing_score?: number;
  is_active?: boolean;
  metadata?: any;
  questions?: ArtifactQuestion[];
  templates?: ArtifactTemplate[];
}

interface ModuleContent6E {
  id: string;
  module_id?: string;
  stage_order?: number;
  stage_name?: string;
  lte_6e_stage?: string;
  stage_description?: string;
  module_context?: string;
  curriculum_reference?: any;
}

interface Module {
  id: string;
  module_no: number;
  title: string;
  description: string;
  prerequisites: any;
  what_youll_learn: any;
  learning_content: any;
  is_published: boolean;
  content: ModuleContent6E[];
  artifacts: Artifact[];
}

interface FullCourseContentEditorProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  onSaved: () => void;
}

export const FullCourseContentEditor: React.FC<FullCourseContentEditorProps> = ({
  isOpen,
  onClose,
  courseId,
  onSaved,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [course, setCourse] = useState<any>(null);
  const [level, setLevel] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [eContent, setEContent] = useState<any[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [expandedArtifacts, setExpandedArtifacts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | '6es' | 'artifacts' | 'econtent'>('overview');
  
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && courseId) {
      fetchCourseContent();
    }
  }, [isOpen, courseId]);

  const fetchCourseContent = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/lte/course-content?courseId=${courseId}`);
      const data = await res.json();
      
      if (data.success) {
        setCourse(data.course);
        setLevel(data.level || null);
        setModules(data.modules || []);
        setEContent(data.eContent || []);
        
        // Expand first module by default if available
        if (data.modules && data.modules.length > 0) {
          setExpandedModules(new Set([data.modules[0].id]));
        }
      } else {
        toast({
          title: 'Failed to Load Content',
          description: data.error || 'Could not fetch course content',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error Loading Content',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/lte/course-content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          updates: {
            course: {
              course_name: course.course_name,
              short_name: course.short_name,
              description: course.description,
            },
            modules: modules.map(m => ({
              id: m.id,
              title: m.title,
              description: m.description,
              learning_content: m.learning_content,
              prerequisites: m.prerequisites,
              what_youll_learn: m.what_youll_learn,
              is_published: m.is_published,
              content: m.content || [],
              artifacts: m.artifacts || [],
            })),
            eContent,
          },
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Content Saved',
          description: 'Course content, 6Es stages, and artifacts updated successfully',
        });
        onSaved();
        onClose();
      } else {
        throw new Error(data.error || 'Failed to save');
      }
    } catch (err: any) {
      toast({
        title: 'Save Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const toggleStage = (stageId: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId);
    } else {
      newExpanded.add(stageId);
    }
    setExpandedStages(newExpanded);
  };

  const toggleArtifact = (artifactId: string) => {
    const newExpanded = new Set(expandedArtifacts);
    if (newExpanded.has(artifactId)) {
      newExpanded.delete(artifactId);
    } else {
      newExpanded.add(artifactId);
    }
    setExpandedArtifacts(newExpanded);
  };

  const updateModule = (moduleId: string, field: string, value: any) => {
    setModules(modules.map(m => 
      m.id === moduleId ? { ...m, [field]: value } : m
    ));
  };

  const updateModuleStage = (moduleId: string, stageId: string, field: string, value: any) => {
    setModules(modules.map(m => {
      if (m.id !== moduleId) return m;
      const updatedContent = (m.content || []).map(st => 
        st.id === stageId ? { ...st, [field]: value } : st
      );
      return { ...m, content: updatedContent };
    }));
  };

  const updateModuleArtifact = (moduleId: string, artifactId: string, field: string, value: any) => {
    setModules(modules.map(m => {
      if (m.id !== moduleId) return m;
      const updatedArtifacts = (m.artifacts || []).map(art => 
        art.id === artifactId ? { ...art, [field]: value } : art
      );
      return { ...m, artifacts: updatedArtifacts };
    }));
  };

  const updateArtifactQuestion = (moduleId: string, artifactId: string, questionId: string, field: string, value: any) => {
    setModules(modules.map(module => module.id !== moduleId ? module : {
      ...module,
      artifacts: (module.artifacts || []).map(artifact => artifact.id !== artifactId ? artifact : {
        ...artifact,
        questions: (artifact.questions || []).map(question => question.id !== questionId ? question : { ...question, [field]: value }),
      }),
    }));
  };

  const updateArtifactTemplate = (moduleId: string, artifactId: string, templateId: string, field: string, value: any) => {
    setModules(modules.map(module => module.id !== moduleId ? module : {
      ...module,
      artifacts: (module.artifacts || []).map(artifact => artifact.id !== artifactId ? artifact : {
        ...artifact,
        templates: (artifact.templates || []).map(template => template.id !== templateId ? template : { ...template, [field]: value }),
      }),
    }));
  };

  const updateEContent = (contentId: string, field: string, value: any) => {
    setEContent(eContent.map(item => item.id === contentId ? { ...item, [field]: value } : item));
  };

  const instructionText = (instructions: any): string => {
    if (!instructions) return '';
    if (typeof instructions === 'string') return instructions;
    return instructions.raw_text || instructions.pass_criteria || JSON.stringify(instructions);
  };

  if (!isOpen) return null;

  // Calculate summary metrics
  const total6EsCount = modules.reduce((acc, m) => acc + (m.content?.length || 0), 0);
  const totalArtifactsCount = modules.reduce((acc, m) => acc + (m.artifacts?.length || 0), 0);
  const totalQuestionsCount = modules.reduce((acc, m) => 
    acc + (m.artifacts?.reduce((qAcc, art) => qAcc + (art.questions?.length || 0), 0) || 0), 0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 md:p-6 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-6xl h-[92vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 md:p-6 flex-shrink-0 bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              <span>Full Course Content & Curriculum Editor</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{course?.course_name || 'Loading...'}</span>
              <span>•</span>
              <span>Code: <code className="font-mono bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">{course?.course_code || 'N/A'}</code></span>
              {level && (
                <>
                  <span>•</span>
                  <span>Level: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{level.level_code || level.level_name || 'Active'}</span></span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex gap-1 border-b px-6 flex-shrink-0 bg-white dark:bg-slate-900 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-xs md:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Course Overview
          </button>

          <button
            onClick={() => setActiveTab('modules')}
            className={`px-4 py-3 text-xs md:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'modules'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Modules ({modules.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('6es')}
            className={`px-4 py-3 text-xs md:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === '6es'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>6Es Stages ({total6EsCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('artifacts')}
            className={`px-4 py-3 text-xs md:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'artifacts'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>Artifact Documents ({totalArtifactsCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('econtent')}
            className={`px-4 py-3 text-xs md:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'econtent'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Learning Assets ({eContent.length})</span>
          </button>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/30 dark:bg-slate-900/30">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-sm text-slate-500 font-medium">Loading full course content & curriculum data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && course && (
                <div className="space-y-6 max-w-4xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500 uppercase">Modules Count</p>
                      <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{modules.length}</p>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500 uppercase">6Es Stages</p>
                      <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">{total6EsCount}</p>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500 uppercase">Artifact Documents</p>
                      <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{totalArtifactsCount} <span className="text-xs font-normal text-slate-500">({totalQuestionsCount} Qs)</span></p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      <span>Course Information</span>
                    </h3>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Course Name
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={course.course_name || ''}
                        onChange={(e) => setCourse({ ...course, course_name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Short Name
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={course.short_name || ''}
                        onChange={(e) => setCourse({ ...course, short_name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Description / Problem Statement
                      </label>
                      <textarea
                        rows={5}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={course.description || ''}
                        onChange={(e) => setCourse({ ...course, description: e.target.value })}
                        placeholder="Enter comprehensive course description..."
                      />
                    </div>

                    <div className="bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-indigo-950 dark:text-indigo-200 space-y-1">
                          <p className="font-bold">Catalog Record Metadata</p>
                          <p>Course ID: <span className="font-mono">{course.id}</span></p>
                          <p>Course Code: <span className="font-mono bg-indigo-100 dark:bg-indigo-900 px-2 py-0.5 rounded">{course.course_code}</span></p>
                          <p>Lifecycle Status: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{course.lifecycle_status || 'ACTIVE'}</span></p>
                          <p>Created: {new Date(course.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MODULES */}
              {activeTab === 'modules' && (
                <div className="space-y-4 max-w-5xl mx-auto">
                  {modules.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm">
                      <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <h4 className="text-base font-bold text-slate-700 dark:text-slate-300">No Modules Linked directly in Database</h4>
                      <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
                        If you uploaded a catalog snapshot, ensure you have clicked "Materialize" on the blue level row in Step 3 Catalog Workspace to create all initial module records.
                      </p>
                    </div>
                  ) : (
                    modules.map((module) => (
                      <div
                        key={module.id}
                        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs"
                      >
                        {/* Module Header */}
                        <div
                          onClick={() => toggleModule(module.id)}
                          className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors cursor-pointer border-b"
                        >
                          <div className="flex items-center gap-3">
                            {expandedModules.has(module.id) ? (
                              <ChevronDown className="w-5 h-5 text-indigo-600" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-slate-400" />
                            )}
                            <span className="font-bold text-xs px-2.5 py-1 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                              Module {module.module_no}
                            </span>
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                              {module.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
                              {module.content?.length || 0} 6Es Stages
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                              {module.artifacts?.length || 0} Artifacts
                            </span>
                            {module.is_published && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 font-bold">
                                Published
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Module Content (Expanded) */}
                        {expandedModules.has(module.id) && (
                          <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                  Module Title
                                </label>
                                <input
                                  type="text"
                                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
                                  value={module.title || ''}
                                  onChange={(e) => updateModule(module.id, 'title', e.target.value)}
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                  Module Number
                                </label>
                                <input
                                  type="number"
                                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                                  value={module.module_no || 1}
                                  onChange={(e) => updateModule(module.id, 'module_no', Number(e.target.value))}
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Description
                              </label>
                              <textarea
                                rows={3}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                                value={module.description || ''}
                                onChange={(e) => updateModule(module.id, 'description', e.target.value)}
                              />
                            </div>

                            {/* 6Es Stages Section inside Module */}
                            <div className="space-y-3 pt-3 border-t">
                              <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-2">
                                <Layers className="w-4 h-4" />
                                <span>6Es Learning Stages ({module.content?.length || 0})</span>
                              </h4>
                              
                              {module.content && module.content.length > 0 ? (
                                <div className="space-y-3">
                                  {module.content.map((mc, idx) => (
                                    <div key={mc.id || idx} className="border border-purple-200 dark:border-purple-900/50 rounded-xl p-4 bg-purple-50/30 dark:bg-purple-950/20 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-xs px-2.5 py-1 rounded bg-purple-600 text-white">
                                          Stage {mc.stage_order || idx + 1}: {mc.stage_name || mc.lte_6e_stage || '6E Stage'}
                                        </span>
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                          Stage Description
                                        </label>
                                        <textarea
                                          rows={2}
                                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                          value={mc.stage_description || ''}
                                          onChange={(e) => updateModuleStage(module.id, mc.id, 'stage_description', e.target.value)}
                                        />
                                      </div>

                                      {mc.module_context && (
                                        <div className="space-y-1">
                                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                            Workplace & Engineering Context
                                          </label>
                                          <input
                                            type="text"
                                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                            value={mc.module_context || ''}
                                            onChange={(e) => updateModuleStage(module.id, mc.id, 'module_context', e.target.value)}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 italic">No 6Es stages attached to this module yet.</p>
                              )}
                            </div>

                            {/* Artifact Documents Section inside Module */}
                            <div className="space-y-3 pt-3 border-t">
                              <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                                <CheckSquare className="w-4 h-4" />
                                <span>Artifact Practice Documents ({module.artifacts?.length || 0})</span>
                              </h4>

                              {module.artifacts && module.artifacts.length > 0 ? (
                                <div className="space-y-3">
                                  {module.artifacts.map((art, aIdx) => (
                                    <div key={art.id || aIdx} className="border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-4 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-xs text-emerald-800 dark:text-emerald-200">
                                          📄 {art.artifact_title || `Artifact ${aIdx + 1}`}
                                        </span>
                                        <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-semibold">
                                          {art.questions?.length || 0} Questions
                                        </span>
                                      </div>

                                      <div className="space-y-1">
                                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                          Artifact Title
                                        </label>
                                        <input
                                          type="text"
                                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                                          value={art.artifact_title || ''}
                                          onChange={(e) => updateModuleArtifact(module.id, art.id, 'artifact_title', e.target.value)}
                                        />
                                      </div>

                                      {/* Questions List */}
                                      {art.questions && art.questions.length > 0 && (
                                        <div className="mt-2 space-y-2 border-t border-emerald-200/60 pt-2">
                                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Included Questions:</p>
                                          <div className="space-y-1.5">
                                            {art.questions.map((q: ArtifactQuestion, qIdx: number) => (
                                              <div key={q.id || qIdx} className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 text-xs">
                                                <span className="font-bold text-indigo-600 mr-2">Q{q.question_order || qIdx + 1}:</span>
                                                <span className="text-slate-800 dark:text-slate-200">{q.title || q.description || 'No question text'}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 italic">No artifact practice documents attached to this module.</p>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={module.is_published}
                                  onChange={(e) => updateModule(module.id, 'is_published', e.target.checked)}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Published & Active</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: 6Es CONTENT STAGES */}
              {activeTab === '6es' && (
                <div className="space-y-4 max-w-5xl mx-auto">
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-600" />
                        <span>6Es Learning Framework Overview</span>
                      </h4>
                      <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                        Curriculum structure divided across 6 stages: Engage, Explore, Explain, Elaborate, Evaluate, Extend.
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">
                      {total6EsCount} Total Stages
                    </span>
                  </div>

                  {modules.map((m) => (
                    <div key={m.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4 shadow-xs">
                      <h4 className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border-b pb-2">
                        Module {m.module_no}: {m.title} ({m.content?.length || 0} stages)
                      </h4>

                      {m.content && m.content.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                          {m.content.map((st, idx) => (
                            <div key={st.id || idx} className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs px-2.5 py-1 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                                  Stage {st.stage_order || idx + 1}: {st.stage_name || st.lte_6e_stage || '6E Stage'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                                {st.stage_description || 'No stage description provided.'}
                              </p>
                              {st.module_context && (
                                <p className="text-xs text-slate-500 mt-1 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">Context:</span> {st.module_context}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No 6Es stages defined for this module.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: ARTIFACT DOCUMENTS */}
              {activeTab === 'artifacts' && (
                <div className="space-y-4 max-w-5xl mx-auto">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                        <span>Artifact Practice Documents & Rubrics</span>
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                        Applied learning artifacts and guided practice questions for hands-on evaluation.
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full">
                      {totalArtifactsCount} Artifacts • {totalQuestionsCount} Questions
                    </span>
                  </div>

                  {modules.map((m) => (
                    <div key={m.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4 shadow-xs">
                      <h4 className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border-b pb-2">
                        Module {m.module_no}: {m.title} ({m.artifacts?.length || 0} artifacts)
                      </h4>

                      {m.artifacts && m.artifacts.length > 0 ? (
                        <div className="space-y-3">
                          {m.artifacts.map((art, aIdx) => (
                            <div key={art.id || aIdx} className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                  📄 {art.artifact_title || `Artifact ${aIdx + 1}`}
                                </span>
                                <span className="text-xs px-2.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                                  Type: {art.artifact_type || 'Practice Artifact'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                  Display title
                                  <input className="mt-1 w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900 text-xs" value={art.artifact_title || ''} onChange={(e) => updateModuleArtifact(m.id, art.id, 'artifact_title', e.target.value)} />
                                </label>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                  Artifact type
                                  <input className="mt-1 w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900 text-xs" value={art.artifact_type || ''} onChange={(e) => updateModuleArtifact(m.id, art.id, 'artifact_type', e.target.value)} />
                                </label>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                  Total score
                                  <input type="number" min={1} className="mt-1 w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900 text-xs" value={art.total_score ?? ''} onChange={(e) => updateModuleArtifact(m.id, art.id, 'total_score', Number(e.target.value))} />
                                </label>
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                  Passing score
                                  <input type="number" min={0} className="mt-1 w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900 text-xs" value={art.passing_score ?? ''} onChange={(e) => updateModuleArtifact(m.id, art.id, 'passing_score', e.target.value === '' ? null : Number(e.target.value))} />
                                </label>
                              </div>

                              {art.questions && art.questions.length > 0 && (
                                <div className="space-y-2 pt-2 border-t">
                                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Questions ({art.questions.length}):
                                  </p>
                                  <div className="space-y-2">
                                    {art.questions.map((q, qIdx) => (
                                      <div key={q.id || qIdx} className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                                        <p className="font-semibold text-slate-800 dark:text-slate-200">Question {q.question_order || qIdx + 1}</p>
                                        <input className="w-full px-3 py-2 rounded border bg-white dark:bg-slate-950" value={q.title || ''} onChange={(e) => q.id && updateArtifactQuestion(m.id, art.id, q.id, 'title', e.target.value)} placeholder="Question title" />
                                        <textarea rows={2} className="w-full px-3 py-2 rounded border bg-white dark:bg-slate-950" value={q.description || ''} onChange={(e) => q.id && updateArtifactQuestion(m.id, art.id, q.id, 'description', e.target.value)} placeholder="Question description" />
                                        <textarea rows={2} className="w-full px-3 py-2 rounded border bg-white dark:bg-slate-950" value={instructionText(q.instructions)} onChange={(e) => q.id && updateArtifactQuestion(m.id, art.id, q.id, 'instructions', { ...(typeof q.instructions === 'object' ? q.instructions : {}), raw_text: e.target.value })} placeholder="Learner instructions" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {art.templates && art.templates.length > 0 && (
                                <div className="space-y-2 pt-2 border-t">
                                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Files ({art.templates.length})</p>
                                  {art.templates.map((template, templateIdx) => (
                                    <div key={template.id || templateIdx} className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-2 p-3 bg-white dark:bg-slate-900 rounded-lg border">
                                      <input className="px-3 py-2 rounded border bg-white dark:bg-slate-950 text-xs" value={template.file_name || ''} onChange={(e) => template.id && updateArtifactTemplate(m.id, art.id, template.id, 'file_name', e.target.value)} placeholder="File name" />
                                      <div className="flex gap-2">
                                        <input className="min-w-0 flex-1 px-3 py-2 rounded border bg-white dark:bg-slate-950 text-xs font-mono" value={template.file_url || ''} onChange={(e) => template.id && updateArtifactTemplate(m.id, art.id, template.id, 'file_url', e.target.value)} placeholder="https://..." />
                                        {template.file_url && <a href={template.file_url} target="_blank" rel="noreferrer" className="p-2 text-indigo-600" title="Open file"><ExternalLink className="w-4 h-4" /></a>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No practice artifacts attached to this module.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 5: LEARNING ASSETS / eCONTENT */}
              {activeTab === 'econtent' && (
                <div className="space-y-4 max-w-5xl mx-auto">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span>Media & Learning Assets Repository</span>
                      </h4>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Files, media URLs, videos, and documents associated with this course level.
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                      {eContent.length} Assets
                    </span>
                  </div>

                  {eContent.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                      <File className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-xs text-slate-500">No media assets directly registered in e_content table for this level.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {eContent.map((asset, idx) => (
                        <div key={asset.id || idx} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                              {asset.title || asset.filename || `Asset ${idx + 1}`}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                              {asset.content_type || asset.mime_type || 'Resource'}
                            </span>
                          </div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            Title
                            <input className="mt-1 w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900 text-xs" value={asset.title || ''} onChange={(e) => updateEContent(asset.id, 'title', e.target.value)} />
                          </label>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            Description
                            <textarea rows={2} className="mt-1 w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900 text-xs" value={asset.description || ''} onChange={(e) => updateEContent(asset.id, 'description', e.target.value)} />
                          </label>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            File or content URL
                            <div className="mt-1 flex gap-2">
                              <input className="min-w-0 flex-1 px-3 py-2 rounded-lg border bg-white dark:bg-slate-900 text-xs font-mono" value={asset.url || ''} onChange={(e) => updateEContent(asset.id, 'url', e.target.value)} placeholder="https://..." />
                              {asset.url && <a href={asset.url} target="_blank" rel="noreferrer" className="p-2 text-indigo-600" title="Open asset"><ExternalLink className="w-4 h-4" /></a>}
                            </div>
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Duration (seconds)
                              <input type="number" min={0} className="mt-1 w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900 text-xs" value={asset.duration_seconds ?? ''} onChange={(e) => updateEContent(asset.id, 'duration_seconds', e.target.value === '' ? null : Number(e.target.value))} />
                            </label>
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">XP reward
                              <input type="number" min={0} className="mt-1 w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900 text-xs" value={asset.xp_reward ?? ''} onChange={(e) => updateEContent(asset.id, 'xp_reward', e.target.value === '' ? null : Number(e.target.value))} />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t p-4 md:p-6 flex-shrink-0 bg-slate-50 dark:bg-slate-800/50">
          <div className="text-xs text-slate-500 hidden sm:block">
            Editing <span className="font-semibold text-slate-700 dark:text-slate-300">{course?.course_code || 'Course'}</span> ({modules.length} modules, {total6EsCount} 6Es stages, {totalArtifactsCount} artifacts)
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2 text-xs md:text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-6 py-2 text-xs md:text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
