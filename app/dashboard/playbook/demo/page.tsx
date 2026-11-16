import type { Metadata } from 'next'
import { getPlaybookPageContext } from '@/lib/playbookPage'
import PlaybookClient from '../PlaybookClient'

export const metadata: Metadata = {
  title: 'Business Playbook Demo',
  robots: { index: false, follow: false, nocache: true },
}

export default async function PlaybookDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { workspace, demoStorageKey } = await getPlaybookPageContext()
  const requestedView = (await searchParams).view
  const initialView =
    requestedView === 'review' || requestedView === 'tasks'
      ? requestedView
      : 'procedures'
  return (
    <PlaybookClient
      key={initialView}
      mode="demo"
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      demoStorageKey={demoStorageKey}
      initialView={initialView}
    />
  )
}
