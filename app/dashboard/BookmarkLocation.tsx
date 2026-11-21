import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import { pilotContext } from '@/lib/pilot/access'

export function BookmarkLocation({ id, name }: { id: string; name: string }) {
  async function switchLocation() {
    'use server'
    const { locations } = await pilotContext()
    if (!locations.some((location) => location.id === id)) notFound()
    ;(await cookies()).set(ACTIVE_LOCATION_COOKIE, id, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 3600,
    })
    revalidatePath('/dashboard', 'layout')
  }
  return (
    <main className="pilot" id="main-content">
      <h1>This link belongs to {name}</h1>
      <form action={switchLocation}>
        <button>Switch to {name}</button>
      </form>
    </main>
  )
}
