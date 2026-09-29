'use client';

import React, { useState, useEffect } from 'react';
import Logger, { getErrorMessage } from '@/lib/logger';
import { LTEStepperHeader } from '@/components/lte/LTEStepperHeader';
import { LTEIngestionStep } from '@/components/lte/LTEIngestionStep';
import { LTECatalogSpecificationStep } from '@/components/lte/LTECatalogSpecificationStep';
import { CatalogWorkspace } from '@/components/lte/CatalogWorkspace';
import { LTELearnerViewModal } from '@/components/lte/LTELearnerViewModal';
import { LTECourseMetadata, LTEIngestionSnapshot, LTELevelCourse, LTEPublishProgressState, LTEPublishResult } from '@/types/lte-ingestion';
import { useToast } from '@/hooks/use-toast';

const logger = new Logger('LTECourseUploadPage');

export const LTECourseUploadPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [snapshot, setSnapshot] = useState<LTEIngestionSnapshot | null>(null);
  const [isLearnerModalOpen, setIsLearnerModalOpen] = useState<boolean>(false);
  const [previewCourse, setPreviewCourse] = useState<LTELevelCourse | null>(null);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [publishProgress, setPublishProgress] = useState<LTEPublishProgressState>({
    status: 'idle',
    label: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    logger.info('Initializing LTECourseUploadPage');
    fetch('/api/admin/lte/review')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.snapshot) {
          logger.info('Loaded default review snapshot');
          setSnapshot(data.snapshot);
        }
      })
      .catch((err) => {
        logger.error('Failed to pre-fetch LTE review snapshot', {
          error: getErrorMessage(err),
        });
      });
  }, []);

  const handleSnapshotUpdated = (newSnapshot: LTEIngestionSnapshot) => {
    logger.info('LTE Ingestion snapshot updated', { uploadId: newSnapshot.uploadId });
    setSnapshot(newSnapshot);
  };

  const handlePreviewCourseSaved = async (updatedCourse: LTELevelCourse) => {
    logger.info('Learner preview content saved', {
      levelCode: updatedCourse.levelCode,
      courseTitle: updatedCourse.courseMetadata.courseTitle,
    });

    let savedSnapshot: LTEIngestionSnapshot | null = null;

    if (snapshot?.uploadId) {
      const res = await fetch('/api/admin/lte/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: snapshot.uploadId,
          course: updatedCourse,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const message = data.error || 'Failed to save preview content changes.';
        toast({
          title: 'Save Failed',
          description: message,
          variant: 'destructive',
        });
        throw new Error(message);
      }

      savedSnapshot = data.snapshot;
    }

    setPreviewCourse(updatedCourse);
    setSnapshot((current) => {
      if (!current) return current;
      if (savedSnapshot) return savedSnapshot;

      const existingLevelCourses = current.levelCourses || [];
      const levelCourses = existingLevelCourses.length > 0
        ? existingLevelCourses.map((levelCourse) =>
            levelCourse.levelCode === updatedCourse.levelCode ||
            levelCourse.levelNo === updatedCourse.levelNo
              ? updatedCourse
              : levelCourse
          )
        : [updatedCourse];

      return {
        ...current,
        courseMetadata: updatedCourse.courseMetadata,
        modules: updatedCourse.modules,
        levelCourses,
      };
    });

    toast({
      title: 'Preview Content Saved',
      description: 'Your learner preview changes have been saved in the reviewed snapshot.',
    });
  };

  const handlePublishCourse = async (updatedMetadata: LTECourseMetadata) => {
    setPublishing(true);
    setPublishProgress({
      status: 'queued',
      label: 'Preparing publish job...',
    });
    logger.info('Initiating transactional course publish', {
      courseCode: updatedMetadata.courseCode,
    });

    try {
      const reviewedHash = snapshot?.reviewedSnapshotHash || snapshot?.snapshotHash || 'hash_default';
      const res = await fetch('/api/admin/lte/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: snapshot?.uploadId || 'upload_default',
          reviewedSnapshotHash: reviewedHash,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        toast({
          title: 'Version / Concurrency Conflict (409)',
          description: data.error || 'The reviewed snapshot version or capability structure has changed. Please refresh and re-verify before publishing.',
          variant: 'destructive',
        });
        throw new Error(data.error || 'SNAPSHOT_CHANGED');
      }

      if (res.status === 202) {
        setPublishProgress({
          status: 'validating',
          label: 'A publish job is already running for this upload.',
        });
        toast({
          title: 'Publish in Progress (202)',
          description: 'A catalog publication operation is currently running for this upload record.',
        });
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Publish transaction failed.');
      }

      const publishResult = data.status === 'validating_assets' && data.publishJobId
        ? await waitForQueuedPublish(data.publishJobId)
        : data as LTEPublishResult;

      logger.info('Publish operation succeeded', publishResult);
      setPublishProgress({
        status: 'published',
        label: 'Catalog published successfully.',
        total: publishResult.assetValidation?.total,
        validated: publishResult.assetValidation?.validated,
        failed: publishResult.assetValidation?.failed,
      });
      toast({
        title: 'Course Uploaded & Published Successfully!',
        description: `Inserted ${publishResult.inserted} catalog rows, skipped ${publishResult.skipped} existing rows across tables.`,
      });

      if (snapshot) {
        setSnapshot({ ...snapshot, status: 'published' });
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setPublishProgress((current) => ({
        ...current,
        status: 'failed',
        label: 'Publish failed.',
        error: msg,
      }));
      logger.error('Course publish error', { error: msg });
      if (msg.includes('ASSET_VALIDATION_FAILED')) {
        const fileCount = msg.match(/\((\d+) file/)?.[1];
        const notPublic = msg.includes('DRIVE_NOT_PUBLIC');
        toast({
          title: notPublic ? 'Google Drive Files Are Not Public' : 'Asset Download Failed',
          description: notPublic
            ? `Publish stopped: ${fileCount ? `${fileCount} linked Drive file(s)` : 'linked Drive files'} are not publicly downloadable. For each file: open it in Drive → Share → General access → "Anyone with the link" (Viewer) → republish.`
            : `Publish stopped: ${fileCount ? `${fileCount} linked asset(s)` : 'linked assets'} could not be downloaded. Check the URLs in the workbook and republish.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Publish Failed',
          description: msg.length > 300 ? `${msg.slice(0, 300)}…` : msg,
          variant: 'destructive',
        });
      }
      throw err;
    } finally {
      setPublishing(false);
    }
  };

  const waitForQueuedPublish = async (publishJobId: string): Promise<LTEPublishResult> => {
    toast({
      title: 'Asset Validation Started',
      description: 'Linked files are being downloaded to R2 in the background.',
    });
    setPublishProgress({
      status: 'validating',
      label: 'Validating linked assets...',
      total: 0,
      validated: 0,
      failed: 0,
    });

    const deadline = Date.now() + 90 * 60 * 1000;
    let lastProgress = '';

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const statusRes = await fetch(`/api/admin/lte/publish/${publishJobId}/status`, {
        cache: 'no-store',
      });
      const statusData = await statusRes.json();

      if (!statusRes.ok || !statusData.success) {
        throw new Error(statusData.error || 'Failed to read publish job status.');
      }

      const progress = statusData.assetValidation
        ? `${statusData.assetValidation.validated}/${statusData.assetValidation.total}`
        : '';
      if (statusData.assetValidation) {
        const validation = statusData.assetValidation;
        setPublishProgress({
          status: statusData.status === 'PUBLISHING' ? 'publishing' : 'validating',
          label: statusData.status === 'PUBLISHING'
            ? 'Writing catalog tables...'
            : `Validating linked assets ${validation.validated} / ${validation.total}`,
          total: validation.total,
          validated: validation.validated,
          failed: validation.failed,
          pending: validation.pending,
        });
      }
      if (progress && progress !== lastProgress && statusData.status === 'VALIDATING') {
        lastProgress = progress;
        logger.info('LTE queued publish progress', {
          publishJobId,
          progress,
        });
      }

      if (statusData.status === 'PUBLISHED') {
        setPublishProgress({
          status: 'published',
          label: 'Catalog published successfully.',
          total: statusData.assetValidation?.total,
          validated: statusData.assetValidation?.validated,
          failed: statusData.assetValidation?.failed,
          pending: 0,
        });
        return {
          success: true,
          status: 'published',
          inserted: statusData.inserted || 0,
          skipped: statusData.skipped || 0,
          tableSummary: statusData.tableSummary || {},
          completedAt: statusData.completedAt || new Date().toISOString(),
          catalogPublished: true,
        };
      }

      if (['VALIDATION_FAILED', 'PUBLISH_FAILED'].includes(statusData.status)) {
        const firstFailure = statusData.failedAssets?.[0];
        const failureDetail = firstFailure
          ? `${firstFailure.url}: ${firstFailure.error || firstFailure.errorCode || 'validation failed'}`
          : statusData.error;
        setPublishProgress({
          status: 'failed',
          label: statusData.status === 'VALIDATION_FAILED' ? 'Asset validation failed.' : 'Catalog publish failed.',
          total: statusData.assetValidation?.total,
          validated: statusData.assetValidation?.validated,
          failed: statusData.assetValidation?.failed,
          pending: statusData.assetValidation?.pending,
          error: failureDetail || 'Queued publish failed.',
        });
        throw new Error(failureDetail || 'Queued publish failed.');
      }
    }

    throw new Error('Publish is still running. Please refresh the catalog workspace to check status.');
  };

  return (
    <div className="min-h-screen w-full bg-[#f4f8ff] dark:bg-slate-950 p-3 md:p-4 lg:p-5 space-y-5">
      {/* Stepper Header with 3 steps */}
      <LTEStepperHeader
        currentStep={currentStep}
        onStepClick={(step) => {
          logger.info(`Step clicked: ${step}`);
          setCurrentStep(step);
        }}
      />

      {/* Step 1: Upload & Validate */}
      {currentStep === 1 && (
        <LTEIngestionStep
          snapshot={snapshot}
          onSnapshotUpdated={handleSnapshotUpdated}
          onProceedToStep2={() => setCurrentStep(2)}
        />
      )}

      {/* Step 2: Mapping & Review */}
      {currentStep === 2 && (
        <LTECatalogSpecificationStep
          snapshot={snapshot}
          onBack={() => setCurrentStep(1)}
          onOpenLearnerPreview={(course) => {
            setPreviewCourse(course);
            setIsLearnerModalOpen(true);
          }}
          onPublishCourse={handlePublishCourse}
          publishing={publishing}
          publishProgress={publishProgress}
        />
      )}

      {/* Step 3: Catalog Workspace (Full-screen page) */}
      {currentStep === 3 && <CatalogWorkspace />}

      {/* Learner View Preview Modal */}
      <LTELearnerViewModal
        isOpen={isLearnerModalOpen}
        onClose={() => setIsLearnerModalOpen(false)}
        snapshot={snapshot}
        course={previewCourse}
        onCourseSaved={handlePreviewCourseSaved}
      />
    </div>
  );
};

export default LTECourseUploadPage;
