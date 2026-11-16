import type { Metadata } from 'next'
import { getPlaybookPageContext } from '@/lib/playbookPage'
import PlaybookClient from './PlaybookClient'

export const metadata: Metadata = {
  title: 'Business Playbook',
  robots: { index: false, follow: false, nocache: true },
}

export default async function PlaybookPage() {
  const { workspace } = await getPlaybookPageContext()
  return <PlaybookClient mode="real" workspaceId={workspace.id} workspaceName={workspace.name} />
}
