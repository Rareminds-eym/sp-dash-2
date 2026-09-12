'use client';

import React, { useState } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DraftEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: any;
  onDraftSaved: () => void;
}

export const DraftEditorModal: React.FC<DraftEditorModalProps> = ({
  isOpen,
  onClose,
  draft,
  onDraftSaved,
}) => {
  const [courseName, setCourseName] = useState<string>(draft?.snapshot_data?.course_name || '');
  const [description, setDescription] = useState<string>(draft?.snapshot_data?.description || '');
  const [saving, setSaving] = useState<boolean>(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const { toast } = useToast();

  if (!isOpen || !draft) return null;

  const handleSave = async () => {
    setSaving(true);
    setConflictError(null);

    try {
      const res = await fetch('/api/admin/lte/drafts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: draft.id,
          expectedDraftRevision: draft.draft_revision || 1,
          snapshotData: {
            ...draft.snapshot_data,
            course_name: courseName,
            description,
          },
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setConflictError(data.error || 'DRAFT_CHANGED: Another admin updated this draft concurrently.');
        toast({
          title: 'Draft Revision Conflict (409)',
          description: data.error || 'Concurrent draft edit detected. Please refresh and merge changes.',
          variant: 'destructive',
        });
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save draft');
      }

      toast({
        title: 'Draft Saved Successfully',
        description: `Updated draft revision to ${data.newDraftRevision}.`,
      });

      onDraftSaved();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Error Saving Draft',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Edit Course Draft</span>
              <span className="text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 rounded-full">
                Version {draft.version_no} • Rev {draft.draft_revision || 1}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Optimistic concurrency protected course draft editor</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Alert */}
        {conflictError && (
          <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Optimistic Concurrency Conflict (409)</p>
              <p>{conflictError}</p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Course Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="e.g. Full-Stack Web Engineering"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Course Summary / Description</label>
            <textarea
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter course curriculum overview..."
            />
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] space-y-1 text-slate-500">
            <p className="font-bold text-slate-700 dark:text-slate-300">v1.5 Concurrency Guarantee:</p>
            <p>
              Saves validate `expected_draft_revision`. Concurrent edits return `409 DRAFT_CHANGED` without silent data overwrites.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Draft'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
