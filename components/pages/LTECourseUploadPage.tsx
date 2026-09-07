'use client';

import React, { useState, useEffect } from 'react';
import Logger, { getErrorMessage } from '@/lib/logger';
import { LTEStepperHeader } from '@/components/lte/LTEStepperHeader';
import { LTEIngestionStep } from '@/components/lte/LTEIngestionStep';
import { LTECatalogSpecificationStep } from '@/components/lte/LTECatalogSpecificationStep';
import { LTELearnerViewModal } from '@/components/lte/LTELearnerViewModal';
import { LTECourseMetadata, LTEIngestionSnapshot, LTELevelCourse } from '@/types/lte-ingestion';
import { useToast } from '@/hooks/use-toast';

const logger = new Logger('LTECourseUploadPage');

export const LTECourseUploadPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [snapshot, setSnapshot] = useState<LTEIngestionSnapshot | null>(null);
  const [isLearnerModalOpen, setIsLearnerModalOpen] = useState<boolean>(false);
  const [previewCourse, setPreviewCourse] = useState<LTELevelCourse | null>(null);
  const [publishing, setPublishing] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    logger.info('Initializing LTECourseUploadPage');
    // Pre-fetch default canonical snapshot for initial review state
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

  const handlePublishCourse = async (updatedMetadata: LTECourseMetadata) => {
    setPublishing(true);
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
          title: 'Snapshot Version Changed (409)',
          description: data.error || 'The reviewed snapshot version has changed. Please refresh and re-verify before publishing.',
          variant: 'destructive',
        });
        throw new Error(data.error || 'SNAPSHOT_CHANGED');
      }

      if (res.status === 202) {
        toast({
          title: 'Publish in Progress (202)',
          description: 'A catalog publication operation is currently running for this upload record.',
        });
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Publish transaction failed.');
      }

      logger.info('Publish operation succeeded', data);
      toast({
        title: 'Course Uploaded & Published Successfully!',
        description: `Inserted ${data.inserted} catalog rows, skipped ${data.skipped} existing rows across 13 tables.`,
      });

      if (snapshot) {
        setSnapshot({ ...snapshot, status: 'published' });
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      logger.error('Course publish error', { error: msg });
      toast({
        title: 'Publish Failed',
        description: msg,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f4f8ff] dark:bg-slate-950 p-3 md:p-4 lg:p-5 space-y-5">
      {/* Stepper Header */}
      <LTEStepperHeader
        currentStep={currentStep}
        onStepClick={(step) => {
          logger.info(`Step clicked: ${step}`);
          setCurrentStep(step);
        }}
      />

      {/* Step 1: Live Ingestion & 13-Table Inspector */}
      {currentStep === 1 && (
        <LTEIngestionStep
          snapshot={snapshot}
          onSnapshotUpdated={handleSnapshotUpdated}
          onProceedToStep2={() => setCurrentStep(2)}
        />
      )}

      {/* Step 2: Course Catalog Specification & Mapping */}
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
        />
      )}

      {/* Learner View Preview Modal */}
      <LTELearnerViewModal
        isOpen={isLearnerModalOpen}
        onClose={() => setIsLearnerModalOpen(false)}
        snapshot={snapshot}
        course={previewCourse}
      />
    </div>
  );
};

export default LTECourseUploadPage;
