'use client';

import React, { useState } from 'react';
import {
  Link2,
  FileSpreadsheet,
  CheckCircle2,
  Upload,
  ArrowRight,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Logger, { getErrorMessage } from '@/lib/logger';
import { LTEIngestionSnapshot, LTERelationalValidationReport } from '@/types/lte-ingestion';

const logger = new Logger('LTEIngestionStep');

interface LTEIngestionStepProps {
  snapshot: LTEIngestionSnapshot | null;
  onSnapshotUpdated: (snapshot: LTEIngestionSnapshot) => void;
  onProceedToStep2: () => void;
}

export const LTEIngestionStep: React.FC<LTEIngestionStepProps> = ({
  snapshot,
  onSnapshotUpdated,
  onProceedToStep2,
}) => {
  const [activeTab, setActiveTab] = useState<'google_sheets' | 'xlsx'>('xlsx');
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState<string>(
    'https://docs.google.com/spreadsheets/d/1Zs49uSLCF6T8Po8uVRIH.../edit?usp=sharing'
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isTableSummaryExpanded, setIsTableSummaryExpanded] = useState<boolean>(false);

  const report: LTERelationalValidationReport | null = snapshot?.validationReport || null;

  const handleFetchGoogleSheet = async () => {
    if (!googleSheetsUrl.trim()) {
      setErrorMsg('Please provide a shareable Google Sheets URL.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    logger.info('Fetching Google Sheets ingestion data', { url: googleSheetsUrl });

    try {
      const res = await fetch('/api/admin/lte/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleSheetsUrl }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.snapshot) {
        throw new Error(data.error || 'Failed to fetch and parse Google Sheet.');
      }

      logger.info('Google Sheets ingestion successful', { uploadId: data.uploadId });
      onSnapshotUpdated(data.snapshot);
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      logger.error('Google Sheets ingestion error', { error: msg });
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Client-side file validation
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!file.name.endsWith('.xlsx')) {
      return 'Invalid file type. Please upload an Excel file (.xlsx)';
    }

    // Check file size (10 MB = 10 * 1024 * 1024 bytes)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return `File size exceeds 10MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`;
    }

    return null;
  };

  const handleFileUpload = async (file: File) => {
    // Client-side validation
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMsg(validationError);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setLoading(true);
    setErrorMsg(null);
    logger.info('Uploading XLSX file', { fileName: file.name, fileSize: file.size });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/lte/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.snapshot) {
        throw new Error(data.error || 'Failed to parse uploaded XLSX file.');
      }

      logger.info('XLSX upload ingestion successful', { uploadId: data.uploadId });
      onSnapshotUpdated(data.snapshot);
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      logger.error('XLSX ingestion error', { error: msg });
      setErrorMsg(msg);
      setSelectedFile(null);
    } finally {
      setLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Source Selection Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-[#d7e2ef] dark:border-slate-800 rounded-[16px] p-2 w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-8">
        <button
          onClick={() => setActiveTab('xlsx')}
          className={`w-full sm:w-[260px] py-3 px-5 md:px-8 rounded-[11px] text-xs md:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'xlsx'
              ? 'bg-gradient-to-r from-[#2f5df5] to-[#a10cff] text-white font-bold'
              : 'text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Local Excel (.xlsx)
        </button>
        <button
          onClick={() => setActiveTab('google_sheets')}
          disabled
          className={`w-full sm:w-[300px] py-3 px-5 md:px-8 rounded-[11px] text-xs md:text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === 'google_sheets'
              ? 'bg-gradient-to-r from-[#2f5df5] to-[#a10cff] text-white font-bold'
              : 'text-slate-400 dark:text-slate-500 cursor-not-allowed font-bold'
          }`}
        >
          <Link2 className="w-4 h-4" />
          Google Sheets Sync - Phase 2
        </button>
      
      </div>

      {/* Main Ingestion Form Card */}
      <div className="bg-white dark:bg-slate-900 border border-[#d7e2ef] dark:border-slate-800 rounded-[18px] p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-[#101c32] dark:text-slate-100">
              Live Google Sheets Ingestion & 13-Table Inspector
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Upload the approved LTE workbook to parse and validate the catalog tables.
            </p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800 w-fit">
            Auto-Extracts 15 Database Tables
          </span>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Tab Content 1: Google Sheets URL */}
        {activeTab === 'google_sheets' && (
          <div className="mt-2 space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Google Sheets Shareable URL
            </label>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={googleSheetsUrl}
                onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="flex-1 bg-[#f7f9fc] dark:bg-slate-800/80 border border-[#d7e2ef] dark:border-slate-700 rounded-xl px-4 py-3 text-xs md:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleFetchGoogleSheet}
                disabled={loading}
                className="bg-gradient-to-r from-[#2f5df5] to-[#a10cff] hover:opacity-95 disabled:opacity-50 text-white font-bold px-7 py-3 rounded-xl text-xs md:text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Ingesting...
                  </>
                ) : (
                  <>
                    Fetch & Ingest Google Sheet
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab Content 2: Local Excel file upload */}
        {activeTab === 'xlsx' && (
          <div className="mt-5 space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Select LTE Learning Catalog Excel Workbook (.xlsx)
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors bg-slate-50/50 dark:bg-slate-800/30 ${
                isDragging
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-purple-400'
              }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".xlsx"
                id="xlsx-upload"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                disabled={loading}
              />
              <label htmlFor="xlsx-upload" className={`cursor-pointer space-y-2 block ${loading ? 'opacity-50' : ''}`}>
                {loading ? (
                  <>
                    <Loader2 className="w-8 h-8 text-purple-500 mx-auto animate-spin" />
                    <p className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300">
                      Validating {selectedFile?.name || 'file'}...
                    </p>
                    <p className="text-[11px] text-slate-400">Parsing 15 tables and running validation checks</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-purple-500 mx-auto" />
                    <p className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300">
                      {selectedFile && !errorMsg 
                        ? `✓ ${selectedFile.name}` 
                        : isDragging
                        ? 'Drop file here'
                        : 'Click to select or drag & drop .xlsx file'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Maximum file size: 10 MB (Up to 10,000 rows across sheets)
                    </p>
                  </>
                )}
              </label>
            </div>
            {selectedFile && !errorMsg && !loading && (
              <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Relational Integrity & Schema Validation Report Section */}
      {report && (
        <div className="bg-white dark:bg-slate-900 border border-[#d7e2ef] dark:border-slate-800 rounded-[18px] p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Relational Integrity & Schema Validation Report
            </h3>
            {report.verified ? (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                ✓ VALIDATED
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                ✗ VALIDATION FAILED
              </span>
            )}
          </div>

          {/* Validation Cards */}
          <div className="space-y-3">
            {report.validationItems.map((item) => {
              const bgColor = 
                item.level === 'error' 
                  ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/60'
                  : item.level === 'warning'
                  ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                  : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60';
              const textColor = item.level === 'error'
                ? 'text-red-950 dark:text-red-200'
                : item.level === 'warning'
                ? 'text-amber-950 dark:text-amber-200'
                : 'text-emerald-950 dark:text-emerald-200';
              const iconColor = item.level === 'error'
                ? 'border-red-500 text-red-500'
                : item.level === 'warning'
                ? 'border-amber-500 text-amber-500'
                : 'border-emerald-500 text-emerald-500';
              const badgeColor = item.level === 'error'
                ? 'bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                : item.level === 'warning'
                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';

              return (
                <div
                  key={item.id}
                  className={`border rounded-[14px] px-3 py-3 flex items-center justify-between gap-4 ${bgColor}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${iconColor}`}>
                      {item.verified ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                    </div>
                    <p className={`text-xs md:text-sm font-medium ${textColor}`}>
                      <span className="font-bold mr-1.5">[{item.code || item.category}]</span>
                      {item.message}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider border shrink-0 uppercase ${badgeColor}`}>
                    {item.level}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Table Summaries */}
          {report.tableSummaries && report.tableSummaries.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Table Summary ({report.totalRowsParsed} total rows)
                </h4>
                <button
                  onClick={() => setIsTableSummaryExpanded(!isTableSummaryExpanded)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 border border-purple-200 dark:border-purple-900 transition-colors"
                >
                  {isTableSummaryExpanded ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      View All Tables
                    </>
                  )}
                </button>
              </div>
              {isTableSummaryExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {report.tableSummaries.map((table) => {
                    const statusColor =
                      table.status === 'error'
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                        : table.status === 'warning'
                        ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900'
                        : table.status === 'ready'
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                        : 'bg-slate-50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-700';

                    return (
                      <div
                        key={table.tableName}
                        className={`border rounded-lg p-3 ${statusColor}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                            {table.tableName}
                          </h5>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {table.rowCount} rows
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          {table.details}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Error and Warning Lists */}
          {report.errors && report.errors.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
              <h5 className="text-sm font-bold text-red-900 dark:text-red-100 mb-2">
                Blocking Errors ({report.errors.length})
              </h5>
              <ul className="space-y-1">
                {report.errors.map((error, idx) => (
                  <li key={idx} className="text-xs text-red-700 dark:text-red-300 flex gap-2">
                    <span className="font-mono shrink-0">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.warnings && report.warnings.length > 0 && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
              <h5 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-2">
                Warnings ({report.warnings.length})
              </h5>
              <ul className="space-y-1">
                {report.warnings.map((warning, idx) => (
                  <li key={idx} className="text-xs text-amber-700 dark:text-amber-300 flex gap-2">
                    <span className="font-mono shrink-0">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Default placeholder when no report */}
      {!report && (
        <div className="bg-white dark:bg-slate-900 border border-[#d7e2ef] dark:border-slate-800 rounded-[18px] p-6 space-y-4">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Relational Integrity & Schema Validation Report
            </h3>
          </div>

          <div className="space-y-3 pt-1">
            {[
              {
                id: 'v1',
                title: '[SCHEMA_VERIFICATION]',
                message:
                  '13-Table Database Schema ready: roles, capabilities, level_scale, sequence, skills, levels, modules, content and artifacts.',
              },
              {
                id: 'v2',
                title: '[CURRICULUM_6ES]',
                message:
                  '6 Es Framework (Engage, Explore, Explain, Express, Empower, Evolve) mapped in e_content and modules_content.',
              },
              {
                id: 'v3',
                title: '[ARTIFACTS]',
                message:
                  'Artifact Practices (2 per module) and Final Capstone Artifact structure validated.',
              },
            ].map((item) => (
              <div
                key={item.id}
                className="bg-[#eafaf4] dark:bg-emerald-950/30 border border-[#73e7ba] dark:border-emerald-900/60 rounded-[14px] px-3 py-3 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-5 h-5 rounded-full border-2 border-emerald-500 flex items-center justify-center text-emerald-500 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-emerald-700 dark:text-emerald-400 text-xs md:text-sm tracking-wide mb-0.5">
                      {item.title}
                    </h5>
                    <p className="text-emerald-900 dark:text-emerald-200 font-medium text-xs md:text-sm leading-normal">
                      {item.message}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0 uppercase shadow-2xs">
                  INFO
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Banner - Proceed to Step 2 */}
      <div className="bg-white dark:bg-slate-900 border border-[#d7e2ef] dark:border-slate-800 rounded-[18px] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          {report?.verified ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              STEP 1 INGESTION VERIFIED
            </span>
          ) : report ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
              <Info className="w-3.5 h-3.5 text-red-600" /> VALIDATION ERRORS PRESENT
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
              <Info className="w-3.5 h-3.5 text-slate-600" /> READY TO UPLOAD
            </span>
          )}
          <h4 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
            {report?.verified ? 'Proceed to Course Catalog Specification & Capability Level Mapping' : 'Upload and Validate Course Catalog'}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {report?.verified
              ? 'Configure course metadata, capability level 1–5 assignments, and 6Es module curriculum next.'
              : 'Upload an Excel file or provide a Google Sheets URL to begin validation.'}
          </p>
        </div>

        <button
          onClick={onProceedToStep2}
          disabled={!report?.verified}
          className="min-w-[144px] bg-gradient-to-r from-[#2f5df5] to-[#a10cff] hover:opacity-95 disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 text-white font-bold px-8 py-3 rounded-lg text-sm transition-all flex items-center justify-center gap-2 shrink-0"
        >
          Next
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default LTEIngestionStep;
