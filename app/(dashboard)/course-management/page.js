import { redirect } from 'next/navigation'
import { getSession } from '@/lib/supabase-rls'
import CourseManagementPage from '@/components/pages/CourseManagementPage'

export const runtime = 'edge'

export const metadata = {
    title: 'Course Management - Rareminds Admin',
    description: 'Create and manage courses',
}

export default async function CourseManagementRoute() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    return <CourseManagementPage currentUser={session} />
}
