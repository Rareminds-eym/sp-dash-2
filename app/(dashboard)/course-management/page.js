import CourseManagementPage from '@/components/pages/CourseManagementPage'

export const runtime = 'nodejs'

export const metadata = {
    title: 'Course Management - Rareminds Admin',
    description: 'Create and manage courses',
}

export default async function CourseManagementRoute() {
    // SSO authentication is handled by middleware
    // Page will only render if user is authenticated
    return <CourseManagementPage />
}
