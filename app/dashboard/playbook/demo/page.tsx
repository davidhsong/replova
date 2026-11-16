import type { Metadata } from 'next'
import { getPlaybookPageContext } from '@/lib/playbookPage'
import PlaybookClient from '../PlaybookClient'

export const metadata: Metadata = {
  title: 'Business Playbook Demo',
  robots: { index: false, follow: false, nocache: true },
}

export default async function PlaybookDemoPage() {
  const { workspace, demoStorageKey } = await getPlaybookPageContext()
  return (
    <PlaybookClient
      mode="demo"
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      demoStorageKey={demoStorageKey}
    />
  )
}
