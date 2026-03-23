import { useState } from 'react'
import useAppStore from '../store/useAppStore.js'
import { saveVideoArchive, saveFrameArchive } from '../api/client.js'

export default function SaveResourceButton() {
  const videoId = useAppStore(s => s.videoId)
  const videoFilename = useAppStore(s => s.videoFilename)
  const frames = useAppStore(s => s.frames)
  
  const [showMenu, setShowMenu] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [savedVideoId, setSavedVideoId] = useState(null)

  const handleSaveVideo = async () => {
    if (!videoId) return
    setSaving(true)
    setMessage(null)
    try {
      const archive = await saveVideoArchive(videoId, videoFilename)
      setSavedVideoId(archive.id)
      setMessage({ type: 'success', text: '视频已保存，可以继续保存帧' })
    } catch (e) {
      setMessage({ type: 'error', text: '保存失败: ' + e.message })
    } finally {
      setSaving(false)
      setShowMenu(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleSaveFrames = async () => {
    if (frames.length === 0) return
    setSaving(true)
    setMessage(null)
    try {
      let saved = 0
      for (const frame of frames) {
        await saveFrameArchive({
          frameId: frame.frameId,
          videoId: videoId,
          timestamp: frame.timestamp,
          base64Image: frame.base64Image,
          description: frame.description,
          annotationJson: frame.annotationJson,
          videoArchiveId: savedVideoId // 关联到已保存的视频
        })
        saved++
      }
      setMessage({ type: 'success', text: `${saved} 个帧已保存${savedVideoId ? '并关联到视频' : ''}` })
      setSavedVideoId(null) // 重置
    } catch (e) {
      setMessage({ type: 'error', text: '保存失败: ' + e.message })
    } finally {
      setSaving(false)
      setShowMenu(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // 如果没有视频和帧，不显示按钮
  if (!videoId && frames.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={saving}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
      >
        {saving ? '💾 保存中...' : '💾 保存'}
      </button>

      {showMenu && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 py-1">
          {videoId && (
            <button
              onClick={handleSaveVideo}
              className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              📹 保存视频
              {savedVideoId && <span className="text-green-400 ml-2">✓</span>}
            </button>
          )}
          {frames.length > 0 && (
            <button
              onClick={handleSaveFrames}
              className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              🖼️ 保存所有帧 ({frames.length})
            </button>
          )}
          {savedVideoId && (
            <div className="px-4 py-2 text-xs text-amber-400 border-t border-slate-700">
              提示：先保存视频，再保存帧可以建立关联
            </div>
          )}
        </div>
      )}

      {message && (
        <div className={`absolute top-full right-0 mt-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap z-50 ${
          message.type === 'success' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  )
}
