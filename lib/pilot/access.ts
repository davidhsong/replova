import 'server-only'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAccountForAuthUser } from '@/lib/accountAccess'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'

export async function pilotContext(expected?: string) {
  const jar = await cookies()
  const {
    data: { user },
  } = await createClient(jar).auth.getUser()
  if (!user?.email || !user.email_confirmed_at) redirect('/signin')
  const admin = getSupabaseAdmin()
  const account = await getAccountForAuthUser(admin, user)
  if (!account || (account.auth_user_id && account.auth_user_id !== user.id))
    redirect('/onboard/workspace')
  const [ownedWorkspaces, ownedLocations] = await Promise.all([
    admin
      .from('business_workspaces')
      .select('id,name')
      .eq('account_id', account.id)
      .eq('status', 'active')
      .order('created_at'),
    admin
      .from('restaurants')
      .select('id,name,pilot_timezone,workspace_id')
      .eq('owner_email', account.owner_email)
      .eq('active', true)
      .order('created_at'),
  ])
  const workspaces = checked(ownedWorkspaces) ?? [],
    locations = checked(ownedLocations) ?? []
  const selected =
    locations.find((row) => row.id === jar.get(ACTIVE_LOCATION_COOKIE)?.value) ?? locations[0]
  const workspace = workspaces.find((w) => w.id === selected?.workspace_id) ?? workspaces[0]
  if (!workspace) redirect('/onboard/workspace')
  const location = selected?.workspace_id === workspace.id ? selected : undefined
  const legacyLocation = selected && !selected.workspace_id ? selected : undefined
  if (expected && location?.id !== expected) notFound()
  return { admin, workspace, account, location, legacyLocation, locations: locations.filter(
    (row) => workspaces.some((w) => w.id === row.workspace_id),
  ) }
}
export function checked<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw error
  return data
}
