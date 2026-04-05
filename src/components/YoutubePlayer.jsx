export default function YoutubePlayer({ youtubeId }) {
  return (
    <div className="w-full aspect-video rounded-lg overflow-hidden shadow-md">
      <iframe
        className="w-full h-full"
        src={`https://www.youtube.com/embed/${youtubeId}`}
        title="Srila Prabhupada Lecture"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
