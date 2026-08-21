'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Play,
  Download,
  ArrowLeft,
  Edit3,
  Bot,
  Zap,
  Clock,
  FileText,
} from 'lucide-react';
import Logger from '@/lib/logger';
import { LTEIngestionSnapshot, LTELevelCourse, LTEModule, LTEStage6E } from '@/types/lte-ingestion';

const logger = new Logger('LTELearnerViewModal');

interface LTELearnerViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: LTEIngestionSnapshot | null;
  course?: LTELevelCourse | null;
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

  useEffect(() => {
    const availableModules = course?.modules || snapshot?.modules || [];
    const firstModule = [...availableModules].sort((a, b) => a.index - b.index)[0];
    const firstStage = [...(firstModule?.stages || [])].sort(
      (a, b) => a.stageIndex - b.stageIndex
    )[0];

    setSelectedModuleIndex(0);
    setSelectedStageName(firstStage?.name || '');
  }, [course, snapshot]);

  if (!isOpen) return null;

  const courseMetadata = course?.courseMetadata || snapshot?.courseMetadata;
  const modules: LTEModule[] = course?.modules || snapshot?.modules || [];
  
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

          <button className="justify-self-end flex items-center gap-1.5 rounded-xl border border-blue-200 px-3.5 py-1.5 text-xs font-semibold text-blue-600 transition-all hover:bg-blue-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
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

                <button className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>

              <h3 className="text-lg font-bold text-[#101c32] dark:text-slate-100">
                {currentStage.label || currentStage.name}: Module {currentModule?.index}: {currentStage.subtitle || currentModule?.title}
              </h3>

              {/* Video Player Box */}
              <div className="group relative flex min-h-[260px] w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-xl bg-[#101c32] shadow-inner lg:min-h-[300px]">
                <div className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center cursor-pointer shadow-lg transition-transform group-hover:scale-110">
                  <Play className="w-6 h-6 fill-white ml-1" />
                </div>
                <span className="absolute bottom-4 left-4 text-xs font-semibold text-white/80 bg-slate-900/80 px-3 py-1 rounded-full backdrop-blur-xs">
                  {currentStage.mediaType} lesson • {currentStage.estimatedDuration}
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
                <button className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5">
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

                <button className="rounded-xl bg-[#2458f5] px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700">
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
                  {currentStage.prerequisites.length > 0
                    ? currentStage.prerequisites.join(', ')
                    : 'No prerequisites specified'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block mb-1.5">
                  ⚙ TECHNICAL CONCEPTS
                </span>
                <div className="space-y-1.5">
                  {currentStage.technicalConcepts.map((tc, idx) => (
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
    </div>
  );
};

export default LTELearnerViewModal;
