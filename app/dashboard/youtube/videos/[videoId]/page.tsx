import YouTubeReplyQueue from '@/components/youtube/YouTubeReplyQueue'

export default async function YouTubeVideoCommentsPage({
  params,
}: {
  params: Promise<{ videoId: string }>
}) {
  const { videoId } = await params
  return <YouTubeReplyQueue videoId={videoId} />
}
