import SettingsPage from '@/components/pages/SettingsPage'
import { getSession } from '@/lib/session'

export default async function Settings() {
  const session = await getSession()
  
  return <SettingsPage user={session?.user} />
}