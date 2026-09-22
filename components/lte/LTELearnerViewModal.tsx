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
  Save,
  Link2,
} from 'lucide-react';
import Logger from '@/lib/logger';
import { LTEIngestionSnapshot, LTELevelCourse, LTEModule, LTEStage6E } from '@/types/lte-ingestion';
import { classifyPreviewAsset } from '@/lib/services/lte-ingestion/asset-preview';

const logger = new Logger('LTELearnerViewModal');

interface LTELearnerViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: LTEIngestionSnapshot | null;
  course?: LTELevelCourse | null;
}

function getEmbeddableUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();

  // 1. Google Slides presentation
  if (trimmed.includes('docs.google.com/presentation')) {
    if (trimmed.includes('/embed')) return trimmed;
    return trimmed
      .replace(/\/edit.*$/, '/embed?start=false&loop=false&delayms=3000')
      .replace(/\/pub.*$/, '/embed?start=false&loop=false&delayms=3000')
      .replace(/\/preview.*$/, '/embed?start=false&loop=false&delayms=3000');
  }

  // 2. Google Docs document
  if (trimmed.includes('docs.google.com/document')) {
    if (trimmed.includes('/preview')) return trimmed;
    return trimmed.replace(/\/edit.*$/, '/preview');
  }

  // 3. Google Spreadsheets
  if (trimmed.includes('docs.google.com/spreadsheets')) {
    if (trimmed.includes('/preview')) return trimmed;
    return trimmed.replace(/\/edit.*$/, '/preview');
  }

  // 4. Google Drive file link
  if (trimmed.includes('drive.google.com/file/d/')) {
    if (trimmed.includes('/preview')) return trimmed;
    return trimmed.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
  }

  // 5. YouTube Video link
  if (trimmed.includes('youtube.com/watch') || trimmed.includes('youtu.be/')) {
    const videoId = trimmed.includes('youtube.com/watch')
      ? new URLSearchParams(trimmed.split('?')[1]).get('v')
      : trimmed.split('/').pop()?.split('?')[0];
    if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`;
  }

  // 6. PowerPoint / Word / Office or direct download links
  if (/\.(pptx?|docx?|xlsx?)$/i.test(trimmed) || trimmed.includes('officeapps.live.com')) {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return `https://docs.google.com/gview?url=${encodeURIComponent(trimmed)}&embedded=true`;
    }
  }

  return trimmed;
}

export const LTELearnerViewModal: React.FC<LTELearnerViewModalProps> = ({
  isOpen,
  onClose,
  snapshot,
  course,
}) => {
  const [selectedModuleIndex, setSelectedModuleIndex] = useState<number>(0);
  const [selectedStageName, setSelectedStageName] = useState<string>('Explore');
  const [activeSubTab, setActiveSubTab] = useState<number>(1);
  const [selectedAssetIndex, setSelectedAssetIndex] = useState<number>(0);

  // Edit Content Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editStageTitle, setEditStageTitle] = useState<string>('');
  const [editStageSubtitle, setEditStageSubtitle] = useState<string>('');
  const [editStageDescription, setEditStageDescription] = useState<string>('');
  const [editAssetTitle, setEditAssetTitle] = useState<string>('');
  const [editAssetUrl, setEditAssetUrl] = useState<string>('');
  const [editDuration, setEditDuration] = useState<string>('');
  const [editXpReward, setEditXpReward] = useState<number>(50);
  const [editEngineeringContext, setEditEngineeringContext] = useState<string>('');

  useEffect(() => {
    const availableModules = course?.modules || snapshot?.modules || [];
    const firstModule = [...availableModules].sort((a, b) => a.index - b.index)[0];
    const firstStage = [...(firstModule?.stages || [])].sort(
      (a, b) => a.stageIndex - b.stageIndex
    )[0];

    setSelectedModuleIndex(0);
    setSelectedStageName(firstStage?.name || '');
    setSelectedAssetIndex(0);
  }, [course, snapshot]);

  useEffect(() => setSelectedAssetIndex(0), [selectedModuleIndex, selectedStageName]);

  if (!isOpen) return null;

  const courseMetadata = course?.courseMetadata || snapshot?.courseMetadata;
  const modules: LTEModule[] = course?.modules || snapshot?.modules || [];
  
  // Sort modules by index in ascending order
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

  const handleOpenEdit = () => {
    setEditStageTitle(currentStage.label || currentStage.name);
    setEditStageSubtitle(currentStage.subtitle || '');
    setEditStageDescription(currentStage.description || '');
    setEditAssetTitle(previewAsset?.title || previewAsset?.fileName || '');
    setEditAssetUrl(previewAsset?.url || '');
    setEditDuration(currentStage.estimatedDuration || '5 mins');
    setEditXpReward(currentStage.xpReward || 50);
    setEditEngineeringContext(currentStage.engineeringContext || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    currentStage.label = editStageTitle;
    if (['Engage', 'Explore', 'Explain', 'Express', 'Empower', 'Evolve'].includes(editStageTitle)) {
      currentStage.name = editStageTitle as any;
    }
    currentStage.subtitle = editStageSubtitle;
    currentStage.description = editStageDescription;
    currentStage.estimatedDuration = editDuration;
    currentStage.xpReward = Number(editXpReward) || 50;
    currentStage.engineeringContext = editEngineeringContext;

    if (previewAsset) {
      previewAsset.title = editAssetTitle;
      previewAsset.url = editAssetUrl;
    } else if (editAssetUrl.trim()) {
      if (!currentStage.assets) currentStage.assets = [];
      currentStage.assets.push({
        id: `asset-${Date.now()}`,
        title: editAssetTitle || 'Learning Asset',
        url: editAssetUrl,
        contentType: 'slide',
      });
    }

    setIsEditModalOpen(false);
  };

  const renderPreview = () => {
    if (!previewAsset?.url) {
      return (
        <div className="p-8 text-center text-white">
          <FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <p className="font-semibold text-sm">No preview asset supplied</p>
          <p className="mt-1 text-xs text-slate-400">Click "Edit Content" above to add a Google Slides URL, YouTube URL, or Doc link.</p>
        </div>
      );
    }

    if (previewKind === 'video' && (previewAsset.url.endsWith('.mp4') || previewAsset.url.endsWith('.webm'))) {
      return <video className="h-full w-full bg-black object-contain" controls preload="metadata" src={previewAsset.url} />;
    }

    if (previewKind === 'image') {
      return <img className="h-full w-full object-contain" src={previewAsset.url} alt={previewAsset.title} />;
    }

    if (previewKind === 'audio') {
      return <div className="w-full p-8"><audio className="w-full" controls preload="metadata" src={previewAsset.url} /></div>;
    }

    // Direct in-screen iframe player for all Google Slides, Docs, Drive, YouTube, Office, PDFs, and web links
    const embedUrl = getEmbeddableUrl(previewAsset.url);
    return (
      <iframe
        className="h-full min-h-[350px] w-full border-0 bg-white"
        src={embedUrl}
        title={previewAsset.title || 'Course Presentation Content'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
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
            onClick={handleOpenEdit}
            className="justify-self-end flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/60 px-3.5 py-1.5 text-xs font-bold text-blue-600 transition-all hover:bg-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400 cursor-pointer shadow-2xs"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Content</span>
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
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                        {mod.index}
                      </span>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {mod.title}
                      </h5>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">
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
                  <a
                    href={previewAsset?.url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={!previewAsset?.url}
                    className={`px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-all flex items-center gap-1.5 ${
                      previewAsset?.url ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : 'pointer-events-none opacity-40'
                    }`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in new tab</span>
                  </a>
                </div>
              </div>

              <h3 className="text-lg font-bold text-[#101c32] dark:text-slate-100">
                {currentStage.label || currentStage.name}: Module {currentModule?.index}: {currentStage.subtitle || currentModule?.title}
              </h3>

              {stageAssets.length > 0 && (
                <div className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Stage assets">
                  {stageAssets.map((asset, index) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setSelectedAssetIndex(index)}
                      aria-pressed={selectedAssetIndex === index}
                      className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs ${
                        selectedAssetIndex === index
                          ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200 font-bold'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                      }`}
                    >
                      <span className="block max-w-[180px] truncate font-semibold">{asset.fileName || asset.title}</span>
                      <span className="text-[10px] opacity-70">{classifyPreviewAsset(asset)}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* In-screen Direct Player Container */}
              <div className="group relative flex min-h-[350px] w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-xl bg-[#101c32] shadow-inner lg:min-h-[420px]">
                {renderPreview()}
                <span className="absolute bottom-4 left-4 text-xs font-semibold text-white/80 bg-slate-900/80 px-3 py-1 rounded-full backdrop-blur-xs">
                  {previewAsset?.title || `${currentStage.mediaType} lesson`} • {currentStage.estimatedDuration}
                </span>
              </div>

              {/* Summary card below player */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                {currentStage.description || 'No stage description provided.'}
              </div>

              {currentModule?.artifactPractices?.length > 0 && (
                <div className="flex flex-wrap gap-2" aria-label="Artifact practices">
                  {currentModule.artifactPractices.map((artifact) => (
                    <span
                      key={artifact.id}
                      className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[11px] font-semibold text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300"
                    >
                      Artifact {artifact.practiceIndex}: {artifact.title}
                    </span>
                  ))}
                </div>
              )}

              {/* Player Navigation Footer */}
              <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                  disabled={currentStageIndex <= 0}
                  onClick={() => {
                    if (currentStageIndex > 0) {
                      setSelectedStageName(currentStages[currentStageIndex - 1].name);
                    }
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Previous Stage
                </button>

                <div className="flex items-center gap-1.5">
                  {currentStages.map((stage, index) => (
                    <span
                      key={stage.id}
                      className={`w-2.5 h-2.5 rounded-full ${
                        stage.isCompleted || index === currentStageIndex
                          ? 'bg-blue-600'
                          : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => {
                    if (currentStageIndex < currentStages.length - 1) {
                      setSelectedStageName(currentStages[currentStageIndex + 1].name);
                    }
                  }}
                  className="rounded-xl bg-[#2458f5] px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700"
                >
                  Mark Done & Next (+{currentStage.xpReward} XP)
                </button>
              </div>
            </div>
          </div>

          {/* Column 3: Right Stage Info & Context (3 cols) */}
          <div className="space-y-3 border-l border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:overflow-y-auto">
            {/* Card 1: Current stage information */}
            <div className="space-y-3 rounded-xl border border-blue-300 bg-blue-50/60 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h4 className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                ⚙ {(currentStage.label || currentStage.name).toUpperCase()} STAGE INFO
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                {currentStage.description || 'No stage description provided.'}
              </p>
              <div className="space-y-1.5 text-xs pt-2 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Est. Duration:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {currentStage.estimatedDuration}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Content items:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {currentStage.contentItemsCount} items
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" /> XP Reward:
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    +{currentStage.xpReward} XP
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: MODULE CONTEXT */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                MODULE CONTEXT
              </h4>
              <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {currentModule?.title || 'No module selected'}
              </h5>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-normal">
                {currentModule.contextDescription}
              </p>
            </div>

            {/* Card 3: CURRICULUM REFERENCE */}
            <div className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <h4 className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                ▣ CURRICULUM REFERENCE
              </h4>

              <div>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block mb-1">
                  🎓 PREREQUISITES
                </span>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {currentStage.prerequisites?.length > 0
                    ? currentStage.prerequisites.join(', ')
                    : 'No prerequisites specified'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block mb-1.5">
                  ⚙ TECHNICAL CONCEPTS
                </span>
                <div className="space-y-1.5">
                  {currentStage.technicalConcepts?.map((tc, idx) => (
                    <span
                      key={idx}
                      className="block px-3 py-1 rounded-full text-[11px] font-medium bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-slate-700 dark:text-slate-300 shadow-2xs"
                    >
                      {tc}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block mb-1">
                  ⚙ ENGINEERING CONTEXT
                </span>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {currentStage.engineeringContext || 'No engineering context provided.'}
                </p>
              </div>
            </div>

            {/* Card 4: Ask AI Tutor */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-purple-300 bg-purple-50/70 p-4 shadow-sm dark:border-purple-900/60 dark:bg-purple-950/30">
              <div>
                <h5 className="text-xs font-bold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-purple-600" />
                  Ask AI Tutor
                </h5>
                <p className="text-[11px] text-purple-700 dark:text-purple-300">
                  Get help with this stage
                </p>
              </div>
              <button className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition-all">
                Ask
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Content Editor Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <span>Edit Stage & Asset Content</span>
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Stage Title</label>
                  <input
                    type="text"
                    value={editStageTitle}
                    onChange={(e) => setEditStageTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Duration</label>
                  <input
                    type="text"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Stage Subtitle</label>
                <input
                  type="text"
                  value={editStageSubtitle}
                  onChange={(e) => setEditStageSubtitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Stage Overview / Description</label>
                <textarea
                  rows={3}
                  value={editStageDescription}
                  onChange={(e) => setEditStageDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="p-3 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl space-y-2">
                <label className="font-bold text-purple-900 dark:text-purple-200 block flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-purple-600" />
                  <span>Content Asset URL (Google Slides / YouTube / Doc Link)</span>
                </label>
                <input
                  type="text"
                  placeholder="https://docs.google.com/presentation/d/... or YouTube URL"
                  value={editAssetUrl}
                  onChange={(e) => setEditAssetUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-[11px]"
                />
                <input
                  type="text"
                  placeholder="Asset Display Title"
                  value={editAssetTitle}
                  onChange={(e) => setEditAssetTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LTELearnerViewModal;
