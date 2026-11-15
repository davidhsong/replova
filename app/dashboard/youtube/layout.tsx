import YouTubeHubNav from '@/components/youtube/YouTubeHubNav'

export default function YouTubeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="youtube-studio-shell">
      <YouTubeHubNav />
      {children}
    </div>
  )
}
