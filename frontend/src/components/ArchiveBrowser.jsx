import { useState, useEffect } from 'react'
import { fetchVideoArchives, fetchFrameArchives, fetchFramesByVideo, deleteVideoArchive, deleteFrameArchive } from '../api/client.js'

export default function ArchiveBrowser({ onSelectVideo, onSelectFrames }) {
  const [activeTab, setActiveTab] = useState('videos')
  const [videos, setVideos] = useState([])
  const [frames, setFrames] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [videoFrames, setVideoFrames] = useState([])

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'videos') {
        const data = await fetchVideoArchives()
        setVideos(data || [])
      } else {
        const data = await fetchFrameArchives()
        setFrames(data || [])
      }
    } catch (e) {
      console.error('Failed to load archives:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectVideo = async (video) => {
    setSelectedVideo(video)
    
    // 加载关联的帧
    try {
      const relatedFrames = await fetchFramesByVideo(video.id)
      setVideoFrames(relatedFrames || [])
      
      // 回调给父组件，传入视频和关联帧
      if (onSelectVideo) {
        onSelectVideo(video, relatedFrames || [])
      }
    } catch (e) {
      console.error('Failed to load video frames:', e)
      if (onSelectVideo) {
        onSelectVideo(video, [])
      }
    }
  }

  const handleDeleteVideo = async (id) => {
    if (!confirm('确定要删除这个视频归档吗？关联的帧也会被删除。')) return
    try {
      await deleteVideoArchive(id)
      if (selectedVideo?.id === id) {
        setSelectedVideo(null)
        setVideoFrames([])
      }
      loadData()
    } catch (e) {
      alert('删除失败: ' + e.message)
    }
  }

  const handleDeleteFrame = async (id) => {
    if (!confirm('确定要删除这个帧归档吗？')) return
    try {
      await deleteFrameArchive(id)
      loadData()
      // 如果当前选中的视频的帧被删除了，刷新帧列表
      if (selectedVideo) {
        const relatedFrames = await fetchFramesByVideo(selectedVideo.id)
        setVideoFrames(relatedFrames || [])
      }
    } catch (e) {
      alert('删除失败: ' + e.message)
    }
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-slate-400 text-xs uppercase tracking-wider">归档资源</h3>
        <div className="flex gap-1">
          {['videos', 'frames'].map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                setSelectedVideo(null)
                setVideoFrames([])
              }}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                activeTab === tab 
                  ? 'bg-slate-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              {tab === 'videos' ? '视频' : '帧'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4 text-slate-500 text-xs">加载中...</div>
      ) : activeTab === 'videos' ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {videos.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-xs">暂无保存的视频</div>
          ) : (
            videos.map(video => (
              <div key={video.id} className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer ${
                selectedVideo?.id === video.id ? 'bg-blue-900/30 border border-blue-700' : 'bg-slate-900/50'
              }`}>
                <div className="w-10 h-10 bg-slate-700 rounded flex items-center justify-center text-lg">📹</div>
                <div className="flex-1 min-w-0" onClick={() => handleSelectVideo(video)}>
                  <div className="text-slate-300 text-xs truncate">{video.filename}</div>
                  <div className="text-slate-500 text-[10px]">
                    {video.duration}s · {formatSize(video.fileSize)} · {video.frameCount || 0}帧
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleSelectVideo(video)}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
                  >
                    使用
                  </button>
                  <button
                    onClick={() => handleDeleteVideo(video.id)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))
          )}
          
          {/* 显示选中视频的关联帧 */}
          {selectedVideo && videoFrames.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="text-xs text-slate-400 mb-2">
                关联帧 ({videoFrames.length})
              </div>
              <div className="grid grid-cols-4 gap-1">
                {videoFrames.map(frame => (
                  <div key={frame.id} className="aspect-video bg-slate-900 rounded overflow-hidden">
                    {frame.base64Preview && (
                      <img
                        src={`data:image/jpeg;base64,${frame.base64Preview}`}
                        alt={frame.description}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => onSelectFrames?.(videoFrames)}
                className="mt-2 w-full py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded"
              >
                使用全部 {videoFrames.length} 个帧
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {frames.length === 0 ? (
            <div className="col-span-3 text-center py-4 text-slate-500 text-xs">暂无保存的帧</div>
          ) : (
            frames.map(frame => (
              <div key={frame.id} className="group relative aspect-video bg-slate-900 rounded-lg overflow-hidden">
                {frame.base64Preview && (
                  <img
                    src={`data:image/jpeg;base64,${frame.base64Preview}`}
                    alt={frame.description}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <button
                    onClick={() => onSelectFrames?.([frame])}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
                  >
                    使用
                  </button>
                  <button
                    onClick={() => handleDeleteFrame(frame.id)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                  >
                    删除
                  </button>
                </div>
                {frame.description && (
                  <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/70 text-[10px] text-white truncate">
                    {frame.description}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}
