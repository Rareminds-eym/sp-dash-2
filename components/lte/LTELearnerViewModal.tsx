'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  ArrowLeft,
  Edit3,
  Bot,
  Zap,
  Clock,
  FileText,
  ExternalLink,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Code2,
  Copy,
  GraduationCap,
  Layers,
  Lightbulb,
  MessageSquare,
  Target,
} from 'lucide-react';
import Logger from '@/lib/logger';
import { LTEArtifactPractice, LTEIngestionSnapshot, LTELevelCourse, LTEModule, LTEStage6E } from '@/types/lte-ingestion';
import { classifyPreviewAsset } from '@/lib/services/lte-ingestion/asset-preview';

const logger = new Logger('LTELearnerViewModal');

interface LTELearnerViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: LTEIngestionSnapshot | null;
  course?: LTELevelCourse | null;
  onCourseSaved?: (course: LTELevelCourse) => void | Promise<void>;
}

export const LTELearnerViewModal: React.FC<LTELearnerViewModalProps> = ({
  isOpen,
  onClose,
  snapshot,
  course,
  onCourseSaved,
}) => {
  const [selectedModuleIndex, setSelectedModuleIndex] = useState<number>(0);
  const [selectedStageName, setSelectedStageName] = useState<string>('Explore');
  const [activeSubTab, setActiveSubTab] = useState<number>(1);
  const [selectedAssetIndex, setSelectedAssetIndex] = useState<number>(0);
  const [isProblemExpanded, setIsProblemExpanded] = useState<boolean>(false);
  const [isEditingContent, setIsEditingContent] = useState<boolean>(false);
  const [isSavingContent, setIsSavingContent] = useState<boolean>(false);
  const [editableCourse, setEditableCourse] = useState<LTELevelCourse | null>(course || null);
  const [completedStageIds, setCompletedStageIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const availableModules = course?.modules || snapshot?.modules || [];
    const firstModule = [...availableModules].sort((a, b) => a.index - b.index)[0];
    const firstStage = [...(firstModule?.stages || [])].sort(
      (a, b) => a.stageIndex - b.stageIndex
    )[0];

    setSelectedModuleIndex(0);
    setSelectedStageName(firstStage?.name || '');
    setSelectedAssetIndex(0);
    setEditableCourse(course || null);
    setIsEditingContent(false);
    setCompletedStageIds(new Set());
  }, [course, snapshot]);

  useEffect(() => setSelectedAssetIndex(0), [selectedModuleIndex, selectedStageName]);

  if (!isOpen) return null;

  const displayCourse = editableCourse || course || null;
  const courseMetadata = displayCourse?.courseMetadata || snapshot?.courseMetadata;
  const modules: LTEModule[] = displayCourse?.modules || snapshot?.modules || [];
  
  // Sort modules by index in ascending order (as per Property 11)
  const sortedModules = [...modules].sort((a, b) => a.index - b.index);

  const currentModule = sortedModules[selectedModuleIndex] || sortedModules[0];
  const currentStages = [...(currentModule?.stages || [])].sort(
    (a, b) => a.stageIndex - b.stageIndex
  );
  const currentStage: LTEStage6E =
    currentStages.find((st) => st.name === selectedStageName) ||
    currentStages[0] || {
      id: 'default-st',
      stageIndex: 2,
      name: 'Engage',
      label: 'No stage',
      subtitle: 'No course content available',
      description: 'No stage description provided.',
      mediaType: 'article',
      estimatedDuration: 'Not specified',
      contentItemsCount: 0,
      xpReward: 0,
      prerequisites: [],
      technicalConcepts: [],
      engineeringContext: '',
    };
  const currentStageIndex = currentStages.findIndex((stage) => stage.id === currentStage.id);
  const totalXp = sortedModules.reduce(
    (total, module) => total + module.stages.reduce((sum, stage) => sum + (stage.xpReward || 0), 0),
    0
  );
  const capabilityLevel =
    courseMetadata?.capabilityLevel || course?.levelName || course?.levelCode || 'Level not specified';
  const stageAssets = currentStage.assets || [];
  const previewAsset = stageAssets[selectedAssetIndex] || stageAssets[0];
  const previewKind = previewAsset ? classifyPreviewAsset(previewAsset) : null;
  const stageTitle = currentStage.subtitle || currentModule?.title || '';
  const normalizedStageTitle = stageTitle
    .replace(new RegExp(`^${currentStage.label || currentStage.name}:\\s*`, 'i'), '')
    .trim();
  const stageLabel = currentStage.label || currentStage.name;
  const currentArtifact =
    currentModule?.artifactPractices?.find((artifact) => artifact.stageName === currentStage.name) ||
    currentModule?.artifactPractices?.find((artifact) => currentStage.name === 'Express' && artifact.artifactType !== 'final') ||
    currentModule?.artifactPractices?.find((artifact) => currentStage.name === 'Evolve' && artifact.artifactType === 'final') ||
    null;
  const hasCurrentArtifact = Boolean(currentArtifact);

  const selectStageByIndex = (index: number) => {
    const nextStage = currentStages[index];
    if (!nextStage) return;
    setSelectedStageName(nextStage.name);
    setSelectedAssetIndex(0);
  };

  const handlePreviousStage = () => {
    if (currentStageIndex > 0) {
      selectStageByIndex(currentStageIndex - 1);
      return;
    }

    const previousModuleIndex = selectedModuleIndex - 1;
    const previousModule = sortedModules[previousModuleIndex];
    if (!previousModule) return;
    const previousStages = [...(previousModule.stages || [])].sort((a, b) => a.stageIndex - b.stageIndex);
    setSelectedModuleIndex(previousModuleIndex);
    setSelectedStageName(previousStages[previousStages.length - 1]?.name || '');
    setSelectedAssetIndex(0);
  };

  const handleNextStage = () => {
    setCompletedStageIds((current) => new Set([...current, currentStage.id]));

    if (selectedAssetIndex < stageAssets.length - 1) {
      setSelectedAssetIndex((index) => index + 1);
      return;
    }

    if (currentStageIndex < currentStages.length - 1) {
      selectStageByIndex(currentStageIndex + 1);
      return;
    }

    const nextModuleIndex = selectedModuleIndex + 1;
    const nextModule = sortedModules[nextModuleIndex];
    if (!nextModule) return;
    const nextStages = [...(nextModule.stages || [])].sort((a, b) => a.stageIndex - b.stageIndex);
    setSelectedModuleIndex(nextModuleIndex);
    setSelectedStageName(nextStages[0]?.name || '');
    setSelectedAssetIndex(0);
  };

  const updateEditableCourse = (updater: (course: LTELevelCourse) => LTELevelCourse) => {
    setEditableCourse((current) => {
      if (!current && !course) return current;
      return updater(current || (course as LTELevelCourse));
    });
  };

  const updateCourseMetadata = (field: keyof LTELevelCourse['courseMetadata'], value: string) => {
    updateEditableCourse((current) => ({
      ...current,
      courseMetadata: {
        ...current.courseMetadata,
        [field]: value,
      },
    }));
  };

  const updateCurrentModule = (field: keyof LTEModule, value: string | string[]) => {
    updateEditableCourse((current) => ({
      ...current,
      modules: current.modules.map((module) =>
        module.index === currentModule?.index
          ? {
              ...module,
              [field]: value,
            }
          : module
      ),
    }));
  };

  const updateCurrentStage = (field: keyof LTEStage6E, value: string | string[] | number) => {
    updateEditableCourse((current) => ({
      ...current,
      modules: current.modules.map((module) =>
        module.index === currentModule?.index
          ? {
              ...module,
              stages: module.stages.map((stage) =>
                stage.id === currentStage.id
                  ? {
                      ...stage,
                      [field]: value,
                    }
                  : stage
              ),
            }
          : module
      ),
    }));
  };

  const updateCurrentStageAsset = (
    assetId: string,
    field: 'title' | 'fileName' | 'url' | 'contentType',
    value: string
  ) => {
    updateEditableCourse((current) => ({
      ...current,
      modules: current.modules.map((module) =>
        module.index === currentModule?.index
          ? {
              ...module,
              stages: module.stages.map((stage) =>
                stage.id === currentStage.id
                  ? {
                      ...stage,
                      assets: (stage.assets || []).map((asset) =>
                        asset.id === assetId
                          ? {
                              ...asset,
                              [field]: value,
                            }
                          : asset
                      ),
                    }
                  : stage
              ),
            }
          : module
      ),
    }));
  };

  const handleAssetContentTypeChange = (assetId: string, value: string) => {
    updateCurrentStageAsset(assetId, 'contentType', value);
    if (['video', 'article', 'quiz', 'interactive'].includes(value)) {
      updateCurrentStage('mediaType', value as LTEStage6E['mediaType']);
    }
  };

  const addCurrentStageAsset = () => {
    const newAssetId = `asset-${Date.now()}`;
    updateEditableCourse((current) => ({
      ...current,
      modules: current.modules.map((module) =>
        module.index === currentModule?.index
          ? {
              ...module,
              stages: module.stages.map((stage) =>
                stage.id === currentStage.id
                  ? {
                      ...stage,
                      assets: [
                        ...(stage.assets || []),
                        {
                          id: newAssetId,
                          title: `${stage.label || stage.name} content`,
                          fileName: '',
                          url: '',
                          contentType: 'video',
                        },
                      ],
                      mediaType: 'video',
                      contentItemsCount: (stage.assets || []).length + 1,
                    }
                  : stage
              ),
            }
          : module
      ),
    }));
    setSelectedAssetIndex(stageAssets.length);
  };

  const removeCurrentStageAsset = (assetId: string) => {
    updateEditableCourse((current) => ({
      ...current,
      modules: current.modules.map((module) =>
        module.index === currentModule?.index
          ? {
              ...module,
              stages: module.stages.map((stage) => {
                if (stage.id !== currentStage.id) return stage;
                const assets = (stage.assets || []).filter((asset) => asset.id !== assetId);
                return {
                  ...stage,
                  assets,
                  contentItemsCount: assets.length,
                  mediaType: (assets[0]?.contentType as LTEStage6E['mediaType']) || stage.mediaType,
                };
              }),
            }
          : module
      ),
    }));
    setSelectedAssetIndex(0);
  };

  const updateCurrentArtifact = (field: keyof LTEArtifactPractice, value: string | number) => {
    if (!currentArtifact) return;
    updateEditableCourse((current) => ({
      ...current,
      modules: current.modules.map((module) =>
        module.index === currentModule?.index
          ? {
              ...module,
              artifactPractices: module.artifactPractices.map((artifact) =>
                artifact.id === currentArtifact.id
                  ? {
                      ...artifact,
                      [field]: value,
                    }
                  : artifact
              ),
            }
          : module
      ),
    }));
  };

  const updateCurrentArtifactQuestion = (
    questionId: string,
    field: 'title' | 'description' | 'instructions' | 'responseType',
    value: string
  ) => {
    if (!currentArtifact) return;
    updateEditableCourse((current) => ({
      ...current,
      modules: current.modules.map((module) =>
        module.index === currentModule?.index
          ? {
              ...module,
              artifactPractices: module.artifactPractices.map((artifact) =>
                artifact.id === currentArtifact.id
                  ? {
                      ...artifact,
                      questions: (artifact.questions || []).map((question) =>
                        question.id === questionId
                          ? {
                              ...question,
                              [field]: value,
                            }
                          : question
                      ),
                    }
                  : artifact
              ),
            }
          : module
      ),
    }));
  };

  const updateCurrentArtifactTemplate = (
    templateId: string,
    field: 'fileName' | 'fileUrl' | 'fileType',
    value: string
  ) => {
    if (!currentArtifact) return;
    updateEditableCourse((current) => ({
      ...current,
      modules: current.modules.map((module) =>
        module.index === currentModule?.index
          ? {
              ...module,
              artifactPractices: module.artifactPractices.map((artifact) =>
                artifact.id === currentArtifact.id
                  ? {
                      ...artifact,
                      templates: (artifact.templates || []).map((template) =>
                        template.id === templateId
                          ? {
                              ...template,
                              [field]: value,
                            }
                          : template
                      ),
                    }
                  : artifact
              ),
            }
          : module
      ),
    }));
  };

  const toList = (value: string) =>
    value
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);

  const handleSaveContentEdits = async () => {
    if (!editableCourse) {
      setIsEditingContent(false);
      return;
    }

    setIsSavingContent(true);
    try {
      await onCourseSaved?.(editableCourse);
      setIsEditingContent(false);
    } catch (error) {
      logger.error('Failed to save learner preview content edits', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSavingContent(false);
    }
  };

  const renderPreview = () => {
    if (!previewAsset?.url) return <div className="p-8 text-center text-white"><FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" /><p className="font-semibold">No preview asset was supplied</p><p className="mt-1 text-xs text-slate-400">Add a URL in e_content using file_url, content_url, media_url, url, or asset_url.</p></div>;
    if (previewKind === 'video') return <video className="h-full w-full bg-black object-contain" controls preload="metadata" src={previewAsset.url} />;
    if (previewKind === 'image') return <img className="h-full w-full object-contain" src={previewAsset.url} alt={previewAsset.title} />;
    if (previewKind === 'audio') return <div className="w-full p-8"><audio className="w-full" controls preload="metadata" src={previewAsset.url} /></div>;
    if (previewKind === 'document') return <iframe className="h-full min-h-[300px] w-full bg-white" src={previewAsset.url} title={previewAsset.title} />;
    if (previewKind === 'slides') return <div className="max-w-md rounded-xl border border-slate-600 bg-slate-900 p-6 text-center text-white"><FileText className="mx-auto mb-3 h-10 w-10 text-amber-300" /><p className="font-semibold">{previewAsset.fileName || previewAsset.title}</p><p className="mt-1 text-xs text-slate-300">PowerPoint files open in a compatible viewer or download to your device.</p><div className="mt-4 flex justify-center gap-2"><a className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold" href={previewAsset.url} target="_blank" rel="noreferrer">Open</a><a className="rounded-lg border border-slate-500 px-4 py-2 text-xs font-semibold" href={previewAsset.url} download={previewAsset.fileName || true}>Download</a></div></div>;
    return <a className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white" href={previewAsset.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Open {previewAsset.title}</a>;
  };

  const getInstructionText = (instructions: NonNullable<LTEArtifactPractice['questions']>[number]['instructions']) => {
    if (!instructions) return '';
    if (typeof instructions === 'string') return instructions.trim();
    return (
      instructions.required_fields?.trim() ||
      instructions.pass_criteria?.trim() ||
      instructions.critical_fail?.trim() ||
      ''
    );
  };

  const renderArtifactPreviewPanel = (artifact: LTEArtifactPractice) => {
    const isPractice = artifact.artifactType !== 'final';
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-3 pb-3 pt-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
              isPractice
                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
            }`}>
              <ClipboardCheck className="h-3.5 w-3.5" />
              {isPractice ? 'Practice Artifact' : 'Final Artifact'}
            </h4>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-medium text-slate-500">
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 dark:border-slate-700 dark:bg-slate-900">
                Pass: {artifact.passingScore ?? '-'} / {artifact.totalScore ?? '-'}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 dark:border-slate-700 dark:bg-slate-900">
                {artifact.questions?.length || 0} question{(artifact.questions?.length || 0) === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div className="mt-3 flex border-b border-slate-200 text-[13px] font-bold dark:border-slate-700">
            <span className="border-b-2 border-blue-600 px-3 py-2 text-blue-600">Submit</span>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg border-l-4 border-l-blue-600 bg-blue-50 px-3 py-2.5 text-[13px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
            <Lightbulb className="h-4 w-4 shrink-0" />
            <span>
              {isPractice
                ? 'Complete this practice artifact to understand the concepts.'
                : 'Build and submit your final evaluated artifact.'}
            </span>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h5 className="break-words text-sm font-bold text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100">
            {artifact.title}
          </h5>
          {(artifact.questions || []).length > 0 ? (
            artifact.questions?.map((question, index) => {
              const questionTemplates = (artifact.templates || []).filter(
                (template) => !template.questionId || template.questionId === question.id
              );

              return (
                <div key={question.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        Q{index + 1}
                      </span>
                      <span className="min-w-0 break-words text-[13px] font-bold leading-snug text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100">
                        {question.title}
                      </span>
                    </span>
                    {question.required ? (
                      <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        Required
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-3 p-3.5">
                    <p className="break-words text-[13px] leading-relaxed text-slate-700 [overflow-wrap:anywhere] dark:text-slate-300">
                      {question.description || 'Complete the required artifact response.'}
                    </p>

                    {getInstructionText(question.instructions) ? (
                      <div className="flex min-w-0 items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] leading-5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                        <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                          {getInstructionText(question.instructions)}
                        </span>
                      </div>
                    ) : null}

                    {questionTemplates.length ? (
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold text-slate-500">Templates:</div>
                        <div className="flex flex-wrap gap-2">
                          {questionTemplates.map((template) => (
                            <a
                              key={template.id}
                              href={template.fileUrl || undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            >
                              <Download className="h-3 w-3 shrink-0" />
                              <span className="min-w-0 truncate">{template.fileName}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-800">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <Download className="h-5 w-5 rotate-180" />
                      </span>
                      <span className="mt-3 max-w-full truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                        Upload {question.responseType === 'file' ? 'file' : question.responseType || 'response'}
                      </span>
                      <span className="mt-1 text-[12px] text-slate-500">Click to browse or drag & drop</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800">
              This artifact has no questions configured yet.
            </div>
          )}
        </div>
      </div>
    );
  };

  logger.info('Rendering Learner View Modal', {
    moduleIndex: selectedModuleIndex,
    stageName: selectedStageName,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#101c32]/75 p-3 backdrop-blur-[5px] animate-in fade-in duration-200 sm:p-5">
      <div className="flex h-[92vh] w-[94vw] max-w-[1450px] flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-[#f5f8fc] shadow-[0_28px_80px_rgba(15,28,50,0.35)] dark:border-slate-800 dark:bg-slate-900">
        {/* Top Header Bar */}
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm">
              R
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 tracking-wider">
                RAREMINDS
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                APPLIED LEARNING •
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="max-w-[380px] truncate rounded-full border border-blue-200 bg-slate-50 px-7 py-2 text-xs font-bold text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400">
              {courseMetadata?.courseTitle || 'Untitled course'}
            </span>
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              {totalXp} XP
            </span>
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {capabilityLevel}
            </span>
          </div>

          <button
            onClick={onClose}
            className="justify-self-end flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="w-3.5 h-3.5" />
            Exit Preview
          </button>
        </div>

        {/* Sub-header Bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 bg-[#07172b] px-4 py-2 text-xs text-white sm:px-5">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
              VERIFY LEARNER VIEW:
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSubTab(1)}
                className={`rounded-full border px-5 py-1.5 text-[11px] font-semibold transition-all ${
                  activeSubTab === 1
                    ? 'border-blue-500 bg-[#2458f5] text-white shadow-sm'
                    : 'border-slate-600/60 bg-slate-800/40 text-slate-300 hover:text-white'
                }`}
              >
                ► 1. 6E Interactive Player
              </button>
              <button
                onClick={() => setActiveSubTab(2)}
                className={`rounded-full border px-5 py-1.5 text-[11px] font-semibold transition-all ${
                  activeSubTab === 2
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border-slate-600/60 bg-slate-800/40 text-slate-300 hover:text-white'
                }`}
              >
                2. 6E Modules Overview
              </button>
              <button
                onClick={() => setActiveSubTab(3)}
                className={`rounded-full border px-5 py-1.5 text-[11px] font-semibold transition-all ${
                  activeSubTab === 3
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border-slate-600/60 bg-slate-800/40 text-slate-300 hover:text-white'
                }`}
              >
                3. 5-Level Competency Roadmap
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-800 text-emerald-400 px-3 py-1 rounded-full text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Learner Sandbox
          </div>
        </div>

        {/* Stage Breadcrumb & Tabs Bar */}
        <div className="grid shrink-0 grid-cols-1 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1fr_auto_1fr] sm:px-5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
            OVERVIEW / {(currentModule?.title || 'No module selected').toUpperCase()}
          </span>

          <div className="flex items-center gap-2">
            {currentStages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => setSelectedStageName(stage.name)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  currentStage.id === stage.id
                    ? 'border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {stage.label || stage.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsEditingContent(true)}
            className="justify-self-end flex items-center gap-1.5 rounded-xl border border-blue-200 px-3.5 py-1.5 text-xs font-semibold text-blue-600 transition-all hover:bg-blue-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Content
          </button>
        </div>

        {/* 3-Column Content Body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[250px_minmax(0,1fr)_300px]">
          {/* Column 1: Left Modules List (3 cols) */}
          <div className="space-y-3 border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                MODULES ({sortedModules.length})
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                {capabilityLevel}
              </span>
            </div>

            <div className="space-y-3">
              {sortedModules.map((mod, idx) => (
                <div
                  key={mod.index}
                  onClick={() => {
                    setSelectedModuleIndex(idx);
                    setSelectedStageName(mod.stages?.[0]?.name || '');
                  }}
                  className={`cursor-pointer rounded-xl border p-3 transition-all ${
                    selectedModuleIndex === idx
                      ? 'bg-white dark:bg-slate-800 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                      : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex shrink-0 items-center justify-center">
                        {mod.index}
                      </span>
                      <h5 className="text-xs font-bold leading-snug text-slate-900 dark:text-slate-100">
                        {mod.title}
                      </h5>
                    </div>
                    <span className="ml-2 shrink-0 text-[11px] font-bold text-slate-400">
                      {mod.completionPercentage}%
                    </span>
                  </div>

                  {/* Step dots */}
                  <div className="flex items-center gap-1 mt-2">
                    {[...(mod.stages || [])]
                      .sort((a, b) => a.stageIndex - b.stageIndex)
                      .map((stage) => (
                        <span
                          key={stage.id}
                          className={`w-2 h-2 rounded-full ${
                            stage.isCompleted || (selectedModuleIndex === idx && currentStage.id === stage.id)
                              ? 'bg-blue-600'
                              : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Middle Interactive Player (6 cols) */}
          <div className="flex flex-col p-4 lg:min-w-0 lg:overflow-y-auto lg:p-5">
            <div className="flex flex-1 flex-col space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              {/* Header Badges */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                    {currentStage.mediaType}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {currentStage.estimatedDuration}
                  </span>
                </div>

                <div className="flex gap-2">
                  <a href={previewAsset?.url || undefined} target="_blank" rel="noreferrer" aria-disabled={!previewAsset?.url} className={`px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-all flex items-center gap-1.5 ${previewAsset?.url ? 'hover:bg-slate-100' : 'pointer-events-none opacity-40'}`}><ExternalLink className="w-3.5 h-3.5" />Open asset</a>
                  <a href={previewAsset?.url || undefined} download={previewAsset?.fileName || true} aria-disabled={!previewAsset?.url} className={`px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-all flex items-center gap-1.5 ${previewAsset?.url ? 'hover:bg-slate-100' : 'pointer-events-none opacity-40'}`}><Download className="w-3.5 h-3.5" />Download / open file</a>
                </div>
              </div>

              <h3 className="text-lg font-bold text-[#101c32] dark:text-slate-100">
                {currentStage.label || currentStage.name}: Module {currentModule?.index}: {normalizedStageTitle || currentModule?.title}
              </h3>

              {stageAssets.length > 0 && (
                <div className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Stage assets">
                  {stageAssets.map((asset, index) => (
                    <button key={asset.id} type="button" onClick={() => setSelectedAssetIndex(index)} aria-pressed={selectedAssetIndex === index} className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs ${selectedAssetIndex === index ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>
                      <span className="block max-w-[180px] truncate font-semibold">{asset.fileName || asset.title}</span>
                      <span className="text-[10px] opacity-70">{classifyPreviewAsset(asset)}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Asset-aware learning content preview */}
              <div className="group relative flex min-h-[260px] w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-xl bg-[#101c32] shadow-inner lg:min-h-[300px]">
                {renderPreview()}
                <span className="absolute bottom-4 left-4 text-xs font-semibold text-white/80 bg-slate-900/80 px-3 py-1 rounded-full backdrop-blur-xs">
                  {previewAsset?.title || `${currentStage.mediaType} lesson`} - {currentStage.estimatedDuration}
                </span>
              </div>

              {/* Summary card below player */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                {currentStage.description || 'No stage description provided.'}
              </div>

              {currentModule?.artifactPractices?.length > 0 && (
                <div className="flex flex-wrap gap-2" aria-label="Artifact practices">
                  {currentModule.artifactPractices.map((artifact) => (
                    <button
                      type="button"
                      key={artifact.id}
                      onClick={() => artifact.stageName && setSelectedStageName(artifact.stageName)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                        artifact.stageName === currentStage.name
                          ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300'
                      }`}
                    >
                      Artifact {artifact.practiceIndex}: {artifact.title}
                    </button>
                  ))}
                </div>
              )}

              {/* Player Navigation Footer */}
              <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handlePreviousStage}
                  disabled={selectedModuleIndex === 0 && currentStageIndex <= 0}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Previous Stage
                </button>

                <div className="flex items-center gap-1.5">
                  {currentStages.map((stage, index) => (
                    <span
                      key={stage.id}
                      className={`w-2.5 h-2.5 rounded-full ${
                          stage.isCompleted || completedStageIds.has(stage.id) || index === currentStageIndex
                          ? 'bg-blue-600'
                          : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleNextStage}
                  className="rounded-xl bg-[#2458f5] px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700"
                >
                  {currentStageIndex < currentStages.length - 1 || selectedModuleIndex < sortedModules.length - 1
                    ? `Mark Done & Next (+${currentStage.xpReward} XP)`
                    : 'Finish Preview'}
                </button>
              </div>
            </div>
          </div>

          {/* Column 3: Right Stage Info & Context (3 cols) */}
          <div className="space-y-3 border-l border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:overflow-y-auto">
            {isEditingContent ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
                  <h4 className="text-[13px] font-bold uppercase text-blue-800 dark:text-blue-300">
                    Edit Current Preview Content
                  </h4>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Changes are saved into this reviewed preview course.
                  </p>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase text-slate-500">
                    Main Problem Statement
                  </span>
                  <textarea
                    rows={5}
                    value={courseMetadata?.problemStatement || ''}
                    onChange={(event) => updateCourseMetadata('problemStatement', event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase text-slate-500">
                    Module Context
                  </span>
                  <textarea
                    rows={5}
                    value={currentModule?.contextDescription || ''}
                    onChange={(event) => updateCurrentModule('contextDescription', event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase text-slate-500">
                    Module Problem Statement
                  </span>
                  <textarea
                    rows={4}
                    value={currentModule?.moduleProblemStatement || ''}
                    onChange={(event) => updateCurrentModule('moduleProblemStatement', event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase text-slate-500">
                    {stageLabel} Statement
                  </span>
                  <textarea
                    rows={4}
                    value={currentStage.description || ''}
                    onChange={(event) => updateCurrentStage('description', event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h5 className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300">
                        Middle Player Content
                      </h5>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Add videos, slides, documents, audio, images, or links for this selected stage.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addCurrentStageAsset}
                      className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-blue-700"
                    >
                      Add Content
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        Stage Type
                      </span>
                      <select
                        value={currentStage.mediaType}
                        onChange={(event) => updateCurrentStage('mediaType', event.target.value as LTEStage6E['mediaType'])}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="video">Video</option>
                        <option value="article">Article / Document</option>
                        <option value="interactive">Interactive / Slide</option>
                        <option value="quiz">Quiz</option>
                      </select>
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        Duration
                      </span>
                      <input
                        type="text"
                        value={currentStage.estimatedDuration}
                        onChange={(event) => updateCurrentStage('estimatedDuration', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        XP Reward
                      </span>
                      <input
                        type="number"
                        value={currentStage.xpReward}
                        onChange={(event) => updateCurrentStage('xpReward', Number(event.target.value) || 0)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                  </div>

                  {(currentStage.assets || []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                      No middle player content yet. Click Add Content to add a video, slide, document, or link.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(currentStage.assets || []).map((asset, assetIndex) => (
                        <div
                          key={asset.id}
                          className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase text-slate-500">
                              Content {assetIndex + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeCurrentStageAsset(asset.id)}
                              className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-bold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                            >
                              Remove
                            </button>
                          </div>

                          <label className="block space-y-1">
                            <span className="text-[10px] font-bold uppercase text-slate-500">Title</span>
                            <input
                              type="text"
                              value={asset.title}
                              onChange={(event) => updateCurrentStageAsset(asset.id, 'title', event.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </label>

                          <label className="block space-y-1">
                            <span className="text-[10px] font-bold uppercase text-slate-500">File Name</span>
                            <input
                              type="text"
                              value={asset.fileName || ''}
                              onChange={(event) => updateCurrentStageAsset(asset.id, 'fileName', event.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </label>

                          <label className="block space-y-1">
                            <span className="text-[10px] font-bold uppercase text-slate-500">Google Drive / Content URL</span>
                            <input
                              type="url"
                              value={asset.url || ''}
                              onChange={(event) => updateCurrentStageAsset(asset.id, 'url', event.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </label>

                          <label className="block space-y-1">
                            <span className="text-[10px] font-bold uppercase text-slate-500">Content Type</span>
                            <select
                              value={asset.contentType || ''}
                              onChange={(event) => handleAssetContentTypeChange(asset.id, event.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                              <option value="">Auto detect</option>
                              <option value="video">Video</option>
                              <option value="slides">Slides</option>
                              <option value="document">Document</option>
                              <option value="image">Image</option>
                              <option value="audio">Audio</option>
                              <option value="article">Article / Link</option>
                              <option value="interactive">Interactive</option>
                            </select>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {currentArtifact && (
                  <div className="space-y-3 rounded-2xl border border-purple-200 bg-purple-50 p-3 dark:border-purple-900/60 dark:bg-purple-950/20">
                    <div>
                      <h5 className="text-[11px] font-bold uppercase text-purple-700 dark:text-purple-300">
                        Artifact Content
                      </h5>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Edit artifact instructions and replace template files for this selected stage.
                      </p>
                    </div>

                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        Artifact Title
                      </span>
                      <input
                        type="text"
                        value={currentArtifact.title}
                        onChange={(event) => updateCurrentArtifact('title', event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-1.5">
                        <span className="text-[10px] font-bold uppercase text-slate-500">
                          Passing Score
                        </span>
                        <input
                          type="number"
                          value={currentArtifact.passingScore || 0}
                          onChange={(event) => updateCurrentArtifact('passingScore', Number(event.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-[10px] font-bold uppercase text-slate-500">
                          Total Score
                        </span>
                        <input
                          type="number"
                          value={currentArtifact.totalScore || 0}
                          onChange={(event) => updateCurrentArtifact('totalScore', Number(event.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </label>
                    </div>

                    {(currentArtifact.questions || []).map((question, questionIndex) => (
                      <div key={question.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                        <div className="text-[10px] font-bold uppercase text-slate-500">
                          Question {questionIndex + 1}
                        </div>
                        <input
                          type="text"
                          value={question.title}
                          onChange={(event) => updateCurrentArtifactQuestion(question.id, 'title', event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <textarea
                          rows={3}
                          value={question.description}
                          onChange={(event) => updateCurrentArtifactQuestion(question.id, 'description', event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <textarea
                          rows={3}
                          value={getInstructionText(question.instructions)}
                          onChange={(event) => updateCurrentArtifactQuestion(question.id, 'instructions', event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          placeholder="Instructions / pass criteria / critical fail"
                        />
                      </div>
                    ))}

                    {(currentArtifact.templates || []).map((template, templateIndex) => (
                      <div key={template.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                        <div className="text-[10px] font-bold uppercase text-slate-500">
                          Template {templateIndex + 1}
                        </div>
                        <input
                          type="text"
                          value={template.fileName}
                          onChange={(event) => updateCurrentArtifactTemplate(template.id, 'fileName', event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <input
                          type="url"
                          value={template.fileUrl || ''}
                          onChange={(event) => updateCurrentArtifactTemplate(template.id, 'fileUrl', event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          placeholder="Replacement Google Drive / template URL"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase text-slate-500">
                    Prerequisites
                  </span>
                  <input
                    type="text"
                    value={(currentStage.prerequisites.length > 0 ? currentStage.prerequisites : currentModule?.prerequisites || []).join(' | ')}
                    onChange={(event) => updateCurrentStage('prerequisites', toList(event.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase text-slate-500">
                    Technical Concepts
                  </span>
                  <input
                    type="text"
                    value={currentStage.technicalConcepts.join(' | ')}
                    onChange={(event) => updateCurrentStage('technicalConcepts', toList(event.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase text-slate-500">
                    Credit Context
                  </span>
                  <textarea
                    rows={3}
                    value={currentStage.engineeringContext || ''}
                    onChange={(event) => updateCurrentStage('engineeringContext', event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase text-slate-500">
                    When to Use
                  </span>
                  <textarea
                    rows={3}
                    value={currentStage.whenToUse || ''}
                    onChange={(event) => updateCurrentStage('whenToUse', event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold uppercase text-slate-500">
                    Module Continuity
                  </span>
                  <textarea
                    rows={3}
                    value={currentStage.moduleContinuity || ''}
                    onChange={(event) => updateCurrentStage('moduleContinuity', event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium leading-relaxed text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>

                <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => {
                      setEditableCourse(course || null);
                      setIsEditingContent(false);
                    }}
                    disabled={isSavingContent}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveContentEdits}
                    disabled={isSavingContent}
                    className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                  >
                    {isSavingContent ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <>
            {hasCurrentArtifact && currentArtifact ? (
              renderArtifactPreviewPanel(currentArtifact)
            ) : (
              <>
            {courseMetadata?.problemStatement && (
              <div className="rounded-2xl border border-blue-800 bg-blue-900 p-4 text-white shadow-md">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
                    <BookOpen className="h-4 w-4 text-white" />
                  </span>
                  <h4 className="min-w-0 flex-1 text-[13px] font-bold uppercase leading-snug tracking-wide text-white">
                    Main Problem Statement
                  </h4>
                  <button
                    type="button"
                    aria-label="Copy main problem statement"
                    title="Copy main problem statement"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-blue-100 transition hover:bg-white/10 hover:text-white"
                    onClick={() => void navigator.clipboard?.writeText(courseMetadata.problemStatement)}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>

                <p className={`mt-3 pr-1 text-[13px] leading-5 text-white/90 ${isProblemExpanded ? 'max-h-44 overflow-y-auto' : 'max-h-[60px] overflow-hidden'}`}>
                  {courseMetadata.problemStatement}
                </p>

                <button
                  type="button"
                  className="mt-3 flex w-full items-center justify-start gap-2 border-t border-dashed border-white/20 pt-2.5 text-left text-[12px] font-semibold text-blue-100 transition hover:text-white"
                  aria-expanded={isProblemExpanded}
                  onClick={() => setIsProblemExpanded((expanded) => !expanded)}
                >
                  <span>{isProblemExpanded ? 'Show Less' : 'Show Full Problem Statement'}</span>
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isProblemExpanded ? '-rotate-90' : 'rotate-90'}`} />
                </button>
              </div>
            )}

            {currentModule?.contextDescription && (
              <details open className="group rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
                <summary className="flex cursor-pointer list-none items-center gap-3 text-amber-800 focus:outline-hidden [&::-webkit-details-marker]:hidden">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/60">
                    <FileText className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] font-bold uppercase leading-snug tracking-wide">
                    Module Context
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-amber-700 transition-transform group-open:rotate-90" />
                </summary>
                <p className="pt-3.5 text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
                  {currentModule.contextDescription}
                </p>
              </details>
            )}

            {currentModule?.moduleProblemStatement && (
              <details open className="group rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <summary className="flex cursor-pointer list-none items-center gap-3 text-emerald-800 focus:outline-hidden [&::-webkit-details-marker]:hidden">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/60">
                    <Target className="h-4 w-4 text-emerald-800 dark:text-emerald-300" />
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] font-bold uppercase leading-snug tracking-wide">
                    Module Problem Statement
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-emerald-700 transition-transform group-open:rotate-90" />
                </summary>
                <p className="pt-3.5 text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
                  {currentModule.moduleProblemStatement}
                </p>
              </details>
            )}

            <details open className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <summary className="flex cursor-pointer list-none items-center gap-3 text-blue-800 focus:outline-hidden dark:text-blue-300 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                  <Zap className="h-4 w-4 text-blue-800 dark:text-blue-300" />
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-bold uppercase leading-snug tracking-wide">
                  {stageLabel} Statement
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
              </summary>

              <div className="pt-4">
                <p className="pb-4 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                  {currentStage.description || 'No stage description provided.'}
                </p>
                <div className="text-[12px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2.5 border-t border-slate-200 py-3 dark:border-slate-700">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>Est. {currentStage.estimatedDuration}</span>
                  </div>
                  <div className="flex items-center gap-2.5 border-t border-slate-200 py-3 dark:border-slate-700">
                    <Target className="h-4 w-4 shrink-0" />
                    <span>{currentStage.contentItemsCount} content item{currentStage.contentItemsCount === 1 ? '' : 's'}</span>
                  </div>
                  <div className="flex items-center gap-2.5 border-t border-slate-200 pt-3 dark:border-slate-700">
                    <GraduationCap className="h-4 w-4 shrink-0" />
                    <span>{stageLabel} - {normalizedStageTitle || currentModule?.title}</span>
                  </div>
                </div>
              </div>
            </details>

            {(currentStage.prerequisites.length > 0 || (currentModule?.prerequisites?.length || 0) > 0 || currentStage.technicalConcepts.length > 0 || currentStage.engineeringContext || currentStage.whenToUse || currentStage.moduleContinuity) && (
              <details open className="group rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <summary className="flex cursor-pointer list-none items-center gap-3 border-b border-emerald-200 pb-3 text-emerald-700 focus:outline-hidden dark:border-emerald-900 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/60">
                    <BookOpen className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] font-bold uppercase leading-snug">
                    Curriculum Statement
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
                </summary>

                <div className="space-y-3 pt-4">
                  {(currentStage.prerequisites.length > 0 || (currentModule?.prerequisites?.length || 0) > 0) && (
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                        <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                        <span>Prerequisites</span>
                      </div>
                      <p className="pl-5 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                        {currentStage.prerequisites.length > 0 ? currentStage.prerequisites.join(', ') : currentModule?.prerequisites?.join(', ')}
                      </p>
                    </div>
                  )}

                  {currentStage.technicalConcepts.length > 0 && (
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                        <Code2 className="h-3.5 w-3.5 shrink-0" />
                        <span>Technical Concepts</span>
                      </div>
                      <p className="pl-5 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                        {currentStage.technicalConcepts.join(', ')}
                      </p>
                    </div>
                  )}

                  {currentStage.engineeringContext && (
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                        <Layers className="h-3.5 w-3.5 shrink-0" />
                        <span>Credit Context</span>
                      </div>
                      <p className="pl-5 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                        {currentStage.engineeringContext}
                      </p>
                    </div>
                  )}

                  {currentStage.whenToUse && (
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                        <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                        <span>When to Use</span>
                      </div>
                      <p className="pl-5 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                        {currentStage.whenToUse}
                      </p>
                    </div>
                  )}

                  {currentStage.moduleContinuity && (
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        <span>Module Continuity</span>
                      </div>
                      <p className="pl-5 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                        {currentStage.moduleContinuity}
                      </p>
                    </div>
                  )}
                </div>
              </details>
            )}

            <details open className="group rounded-xl border border-blue-100 bg-blue-50 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20">
              <summary className="flex cursor-pointer list-none items-center gap-3 border-b border-blue-200 pb-3 text-blue-700 focus:outline-hidden dark:border-blue-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/60">
                  <MessageSquare className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-bold uppercase leading-snug">
                  Ask AI Tutor
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  Ask
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
              </summary>

              <div className="space-y-2 pt-3">
                <button type="button" className="flex w-full items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-left text-[13px] font-medium text-blue-700 shadow-sm transition hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-300">
                  <Lightbulb className="h-4 w-4 shrink-0" />
                  <span>What are the authority boundaries?</span>
                </button>
                <button type="button" className="flex w-full items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-left text-[13px] font-medium text-blue-700 shadow-sm transition hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-300">
                  <Code2 className="h-4 w-4 shrink-0" />
                  <span>Explain {stageLabel} concepts</span>
                </button>
                <button type="button" className="flex w-full items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-left text-[13px] font-medium text-blue-700 shadow-sm transition hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-300">
                  <ClipboardCheck className="h-4 w-4 shrink-0" />
                  <span>Help me complete {currentModule?.title || 'this module'}</span>
                </button>
                <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-white p-3 text-[13px] leading-relaxed text-slate-700 dark:border-blue-900 dark:bg-slate-900 dark:text-slate-300">
                  <Bot className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
                  <p>Hello! I am your AI Project Control Tutor. Ask me any question about your current case study or select a prompt above.</p>
                </div>
              </div>
            </details>
              </>
            )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LTELearnerViewModal;

