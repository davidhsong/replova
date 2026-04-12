'use client'

import { supabaseBrowser } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    await supabaseBrowser.auth.signOut()
    router.push('/signin')
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-xs font-medium text-zinc-600 hover:text-zinc-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-zinc-800/60"
    >
      Sign out
    </button>
  )
}
