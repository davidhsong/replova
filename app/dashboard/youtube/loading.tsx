export default function YouTubeLoading() {
  return (
    <div className="page-body youtube-studio-loading" aria-label="Loading YouTube management">
      <div className="youtube-studio-channel-skeleton skeleton" />
      <div className="youtube-studio-video-grid">
        {[0, 1, 2, 3].map(item => <div key={item} className="youtube-studio-card-skeleton skeleton" />)}
      </div>
    </div>
  )
}
