'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface LTEStepperHeaderProps {
  currentStep: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
}

export const LTEStepperHeader: React.FC<LTEStepperHeaderProps> = ({ currentStep, onStepClick }) => {
  return (
    <div className="w-full space-y-4">
      {/* Top Header Title */}
      <div className="flex items-center gap-4 border-b border-[#dce6f2] pb-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center text-[#6338ff]">
          <span className="block h-5 w-5 border-[3px] border-current" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl md:text-[26px] font-bold text-[#101c32] dark:text-slate-100 tracking-tight leading-tight">
            LTE Incremental Course Upload & Catalog Management
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[#70819d] dark:text-slate-400">
            Multi-Sheet Ingestion • Versioning & Mapping • Monotonic Rollback • Catalog Workspace (v1.5)
          </p>
        </div>
      </div>

      {/* Stepper Box */}
      <div className="bg-white dark:bg-slate-900 border border-[#d7e2ef] dark:border-slate-800 rounded-[18px] px-4 md:px-8 py-3.5">
        <div className="flex items-center justify-between gap-3 max-w-[960px] mx-auto">
          {/* Step 1 Badge Card */}
          <div
            onClick={() => onStepClick?.(1)}
            className="flex items-center gap-2.5 cursor-pointer shrink-0"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-all ${
                currentStep === 1
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                  : currentStep > 1
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {currentStep > 1 ? <CheckCircle2 className="w-5 h-5" /> : '1'}
            </div>
            <div>
              <h2 className="text-xs md:text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Upload & Validate
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal mt-0.5">
                Ingestion & Inspection
              </p>
            </div>
          </div>

          <div className="hidden sm:block flex-1 min-w-[24px] max-w-[80px] h-px bg-[#9fb5d3] dark:bg-slate-700 mx-1 self-center" />

          {/* Step 2 Badge Card */}
          <div
            onClick={() => onStepClick?.(2)}
            className="flex items-center gap-2.5 cursor-pointer shrink-0"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-all ${
                currentStep === 2
                  ? 'bg-purple-600 text-white shadow-sm'
                  : currentStep > 2
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500'
              }`}
            >
              {currentStep > 2 ? <CheckCircle2 className="w-5 h-5" /> : '2'}
            </div>
            <div>
              <h2
                className={`text-xs md:text-sm font-bold leading-tight ${
                  currentStep === 2
                    ? 'text-purple-700 dark:text-purple-300'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                Mapping & Review
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal mt-0.5">
                Diff & Versioning Review
              </p>
            </div>
          </div>

          <div className="hidden sm:block flex-1 min-w-[24px] max-w-[80px] h-px bg-[#9fb5d3] dark:bg-slate-700 mx-1 self-center" />

          {/* Step 3 Badge Card: Catalog Workspace */}
          <div
            onClick={() => onStepClick?.(3)}
            className="flex items-center gap-2.5 cursor-pointer shrink-0"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-all ${
                currentStep === 3
                  ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300 dark:ring-indigo-800'
                  : 'bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500'
              }`}
            >
              3
            </div>
            <div>
              <h2
                className={`text-xs md:text-sm font-bold leading-tight ${
                  currentStep === 3
                    ? 'text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                Catalog Workspace
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal mt-0.5">
                Full-Screen Management
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LTEStepperHeader;

