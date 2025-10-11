import SettingsPage from '@/components/pages/SettingsPage'
import { getSession } from '@/lib/supabase-server'

export const runtime = 'edge'

export default async function Settings() {
  const session = await getSession()
  
  return <SettingsPage user={session?.user} />
}