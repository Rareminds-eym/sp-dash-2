import RecruitersPageEnhanced from '@/components/pages/RecruitersPageEnhanced'
import { getSession } from '@/lib/session'

export const runtime = 'edge'

export default async function Recruiters() {
  let session = null
  
  try {
    session = await getSession()
  } catch (error) {
    console.error('Failed to get session:', error.message)
    // Return error page with helpful message
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h1>
          <p className="text-gray-700 mb-4">
            The application is not properly configured. Please contact your administrator.
          </p>
          <p className="text-sm text-gray-500 bg-gray-100 p-3 rounded">
            Technical details: {error.message}
          </p>
        </div>
      </div>
    )
  }
  
  return <RecruitersPageEnhanced currentUser={session?.user} />
}
