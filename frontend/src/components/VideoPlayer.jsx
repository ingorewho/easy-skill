import { useRef, useState, useEffect } from 'react'
import { getVideoStreamUrl } from '../api/client.js'

export default function VideoPlayer({ videoId, duration, onTimeSelect }) {
  const videoRef = useRef()
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)

  const src = getVideoStreamUrl(videoId)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = () => setCurrentTime(video.currentTime)
    video.addEventListener('timeupdate', onTime)
    return () => video.removeEventListener('timeupdate', onTime)
  }, [])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (playing) video.pause()
    else video.play()
    setPlaying(!playing)
  }

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const time = ratio * duration
    if (videoRef.current) videoRef.current.currentTime = time
    setCurrentTime(time)
  }

  const handleCapture = () => {
    onTimeSelect && onTimeSelect(currentTime)
  }

  const fmt = (s) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className='bg-slate-800 rounded-xl overflow-hidden'>
      <video
        ref={videoRef}
        src={src}
        className='w-full aspect-video bg-black'
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      {/* Controls */}
      <div className='p-3'>
        {/* Progress bar */}
        <div
          className='w-full h-2 bg-slate-600 rounded-full cursor-pointer mb-3 relative'
          onClick={handleSeek}
        >
          <div
            className='h-full bg-blue-500 rounded-full'
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
          />
        </div>

        <div className='flex items-center gap-3'>
          <button
            onClick={togglePlay}
            className='w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white text-sm'
          >
            {playing ? '⏸' : '▶'}
          </button>

          <span className='text-slate-400 text-sm font-mono'>
            {fmt(currentTime)} / {fmt(duration || 0)}
          </span>

          <div className='ml-auto'>
            <button
              onClick={handleCapture}
              className='px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors'
            >
              截取当前帧
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
