'use client';

import React, { useState } from 'react';
import { RotateCcw, ShieldAlert, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RollbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: any;
  versions: any[];
  onRollbackComplete: () => void;
}

export const RollbackModal: React.FC<RollbackModalProps> = ({
  isOpen,
  onClose,
  course,
  versions,
  onRollbackComplete,
}) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [confirmDiscardDraft, setConfirmDiscardDraft] = useState<boolean>(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftRevision, setActiveDraftRevision] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  if (!isOpen || !course) return null;

  const publishedVersions = versions.filter((v) => v.status === 'PUBLISHED');

  const handleRollback = async () => {
    if (!selectedVersionId) {
      toast({ title: 'Select Version', description: 'Please select a historical version to roll back to.' });
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/lte/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ROLLBACK_COURSE_VERSION',
          courseId: course.id,
          rollbackSourceVersionId: selectedVersionId,
          confirmDiscardDraft,
          expectedDraftRevision: confirmDiscardDraft ? activeDraftRevision : undefined,
        }),
      });

      const data = await res.json();

      if (res.status === 409 && data.errorCode === 'ACTIVE_DRAFT_EXISTS') {
        setActiveDraftId(data.activeDraftId);
        setActiveDraftRevision(data.activeDraftRevision);
        setErrorMessage(data.error);
        toast({
          title: 'Active Draft Conflict (409)',
          description: 'An uncommitted draft exists. Confirm discarding edits to proceed.',
          variant: 'destructive',
        });
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Rollback failed.');
      }

      toast({
        title: 'Rollback Draft Created',
        description: `Created Version ${data.newVersionNo} as a draft. Review and publish it through the normal workflow.`,
      });

      onRollbackComplete();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message);
      toast({
        title: 'Rollback Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Rollback Course Version</h3>
              <p className="text-xs text-slate-500">Monotonic rollback creating next version from historical snapshot</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 text-xs">
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-3 rounded-xl space-y-1 text-blue-900 dark:text-blue-200">
            <p className="font-bold">Monotonic Rollback Principle:</p>
            <p className="text-[11px] text-blue-700 dark:text-blue-300">
              Rolling back V3 to V1 creates V4 cloned from V1. Previous published versions remain strictly immutable.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Target Rollback Source Version</label>
            <select
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">-- Select historical version --</option>
              {publishedVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  Version {v.version_no} — Published {new Date(v.published_at || v.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          {activeDraftId && (
            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 p-3.5 rounded-xl space-y-2 text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Active Draft Detected (409 ACTIVE_DRAFT_EXISTS)</p>
                  <p className="text-[11px]">An open edit draft (`{activeDraftId}`) exists for this course.</p>
                </div>
              </div>

              <label className="flex items-center gap-2 mt-1 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={confirmDiscardDraft}
                  onChange={(e) => setConfirmDiscardDraft(e.target.checked)}
                  className="rounded border-amber-400"
                />
                <span>Confirm discarding unsaved edits in active draft to proceed</span>
              </label>
            </div>
          )}

          {errorMessage && !activeDraftId && (
            <div className="bg-red-50 text-red-700 p-2.5 rounded-xl text-xs border border-red-200">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleRollback}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{loading ? 'Processing...' : 'Create Rollback Draft'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
