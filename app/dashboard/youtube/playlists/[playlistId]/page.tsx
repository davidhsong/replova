import YouTubeStudioClient from '@/components/youtube/YouTubeStudioClient'

export default async function YouTubePlaylistPage({
  params,
}: {
  params: Promise<{ playlistId: string }>
}) {
  const { playlistId } = await params
  return <YouTubeStudioClient mode="playlist" playlistId={playlistId} />
}
