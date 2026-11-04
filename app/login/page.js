import LoginPageRedesigned from '@/components/pages/LoginPageRedesigned'
import { safeReturnTo } from '@/lib/auth-redirect'

export const dynamic = 'force-dynamic'
export default async function LoginPage({ searchParams }) {
  const params = await searchParams
  return <LoginPageRedesigned returnTo={safeReturnTo(params?.next)} />
}
