import StudentCertificatesPage from '@/components/pages/StudentCertificatesPage'

export const runtime = 'nodejs'

export const metadata = {
    title: 'Student Certificates - Rareminds Admin',
    description: 'View student certificates and download statistics',
}

export default async function StudentCertificatesRoute() {
    // SSO authentication is handled by middleware
    return <StudentCertificatesPage />
}
