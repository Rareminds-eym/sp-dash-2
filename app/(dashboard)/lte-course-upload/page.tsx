import React from 'react';
import LTECourseUploadPage from '@/components/pages/LTECourseUploadPage';

export const runtime = 'nodejs';

export const metadata = {
  title: 'LTE Course Upload - SkillPassport Admin',
  description: 'LTE Google Sheets & Multi-Table Ingestion Pipeline and Course Specification Mapping',
};

export default function LTECourseUploadRoute(): React.JSX.Element {
  return <LTECourseUploadPage />;
}
