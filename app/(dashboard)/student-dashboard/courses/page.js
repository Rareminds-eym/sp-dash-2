import StudentCoursesPage from '@/components/pages/StudentCoursesPage'

export const runtime = 'nodejs'

export const metadata = {
    title: 'Student Courses - Rareminds Admin',
    description: 'View student course enrollments and progress',
}

export default async function StudentCoursesRoute() {
    // SSO authentication is handled by middleware
    return <StudentCoursesPage />
}
