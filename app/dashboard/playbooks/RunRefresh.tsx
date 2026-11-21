'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RunRefresh({ revision }: { revision: number }) {
  const router = useRouter()
  useEffect(() => {
    let editing = false
    const markEditing = () => {
      editing = true
    }
    document.addEventListener('input', markEditing)
    const timer = window.setInterval(() => {
      if (!editing && document.visibilityState === 'visible') router.refresh()
    }, 12000)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('input', markEditing)
    }
  }, [router, revision])
  return null
}
