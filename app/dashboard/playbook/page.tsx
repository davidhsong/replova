import type { Metadata } from 'next'
import { getPlaybookPageContext } from '@/lib/playbookPage'
import PlaybookClient from './PlaybookClient'

export const metadata: Metadata = {
  title: 'Business Playbook',
  robots: { index: false, follow: false, nocache: true },
}

export default async function PlaybookPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { workspace } = await getPlaybookPageContext()
  const requestedView = (await searchParams).view
  const initialView =
    requestedView === 'review' || requestedView === 'tasks'
      ? requestedView
      : 'procedures'
  return (
    <PlaybookClient
      key={initialView}
      mode="real"
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      initialView={initialView}
    />
  )
}
