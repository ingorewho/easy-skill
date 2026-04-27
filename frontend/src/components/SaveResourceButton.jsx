import { useState } from 'react'
import useAppStore from '../store/useAppStore.js'
import { saveVideoArchive, saveFrameArchive } from '../api/client.js'
import { Save, Film, Images, Loader2, Check, AlertCircle } from 'lucide-react'

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
    setSaving(true); setMessage(null)
    try {
      const archive = await saveVideoArchive(videoId, videoFilename)
      setSavedVideoId(archive.id)
      setMessage({ type: 'success', text: '视频已保存，可继续保存帧' })
    } catch (e) {
      setMessage({ type: 'error', text: '保存失败：' + e.message })
    } finally {
      setSaving(false); setShowMenu(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleSaveFrames = async () => {
    if (frames.length === 0) return
    setSaving(true); setMessage(null)
    try {
      let saved = 0
      for (const frame of frames) {
        await saveFrameArchive({
          frameId: frame.frameId,
          videoId,
          timestamp: frame.timestamp,
          base64Image: frame.base64Image,
          description: frame.description,
          annotationJson: frame.annotationJson,
          videoArchiveId: savedVideoId,
        })
        saved++
      }
      setMessage({ type: 'success', text: `${saved} 个帧已保存${savedVideoId ? '并关联到视频' : ''}` })
      setSavedVideoId(null)
    } catch (e) {
      setMessage({ type: 'error', text: '保存失败：' + e.message })
    } finally {
      setSaving(false); setShowMenu(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  if (!videoId && frames.length === 0) return null

  return (
    <div className='relative'>
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={saving}
        className='btn-ghost disabled:opacity-60'
      >
        {saving ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : <Save className='w-3.5 h-3.5' />}
        <span>{saving ? '保存中' : '保存'}</span>
      </button>

      {showMenu && (
        <>
          <div className='fixed inset-0 z-40' onClick={() => setShowMenu(false)} />
          <div className='absolute top-full right-0 mt-2 w-56 card-paper shadow-lift z-50 py-1.5 animate-fade-up overflow-hidden'>
            {videoId && (
              <button
                onClick={handleSaveVideo}
                className='w-full px-4 py-2.5 text-left text-[13px] text-ink-700 hover:bg-paper-200/50 hover:text-ink-900 transition-colors flex items-center gap-2.5'
              >
                <Film className='w-3.5 h-3.5 text-ink-400' />
                <span className='flex-1'>保存视频</span>
                {savedVideoId && <Check className='w-3.5 h-3.5 text-sage-700' />}
              </button>
            )}
            {frames.length > 0 && (
              <button
                onClick={handleSaveFrames}
                className='w-full px-4 py-2.5 text-left text-[13px] text-ink-700 hover:bg-paper-200/50 hover:text-ink-900 transition-colors flex items-center gap-2.5'
              >
                <Images className='w-3.5 h-3.5 text-ink-400' />
                <span className='flex-1'>保存所有帧</span>
                <span className='font-mono text-[10.5px] text-ink-400'>{frames.length}</span>
              </button>
            )}
            {savedVideoId && (
              <div className='px-4 py-2 text-[11px] text-umber-600 border-t hairline bg-umber-50/40 leading-relaxed'>
                提示 · 先保存视频，再保存帧可建立关联
              </div>
            )}
          </div>
        </>
      )}

      {message && (
        <div className={`absolute top-full right-0 mt-2 px-3 py-2 rounded-full text-[11.5px] whitespace-nowrap z-50 border flex items-center gap-1.5 animate-fade-up
          ${message.type === 'success'
            ? 'bg-sage-300/20 border-sage-500/30 text-sage-700'
            : 'bg-clay-500/10 border-clay-500/25 text-clay-700'}`}>
          {message.type === 'success' ? <Check className='w-3 h-3' /> : <AlertCircle className='w-3 h-3' />}
          {message.text}
        </div>
      )}
    </div>
  )
}
