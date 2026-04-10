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
      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      Sign out
    </button>
  )
}
