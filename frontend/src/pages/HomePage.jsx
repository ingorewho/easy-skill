import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadVideo, fetchSkillList } from '../api/client.js'
import useAppStore from '../store/useAppStore.js'

export default function HomePage() {
  const navigate = useNavigate()
  const setVideo = useAppStore(s => s.setVideo)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const reset = useAppStore(s => s.reset)

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [skillCount, setSkillCount] = useState(0)
  const inputRef = useRef()

  // 加载历史 Skill 数量
  useEffect(() => {
    fetchSkillList().then(list => {
      setSkillCount(list?.length || 0)
    }).catch(() => {
      setSkillCount(0)
    })
  }, [])

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('video/')) {
      setError('请上传视频文件（MP4、MOV 等）')
      return
    }
    setError(null)
    setUploading(true)
    setProgress(0)
    reset()

    try {
      const res = await uploadVideo(file, setProgress)
      setVideo(res.videoId, res.filename, res.duration)
      navigate(`/playground/${res.videoId}`)
    } catch (e) {
      setError(e.message)
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  return (
    <div className='min-h-screen flex flex-col items-center justify-center p-8'>
      {/* Header */}
      <div className='text-center mb-12'>
        <h1 className='text-4xl font-bold text-white mb-3'>
          <span className='text-blue-400'>Easy</span> Skill
        </h1>
        <p className='text-slate-400 text-lg'>上传操作视频，AI 自动生成可复用的 Skill</p>
      </div>

      {/* Upload zone */}
      <div
        className={`w-full max-w-xl border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all
          ${dragging ? 'border-blue-400 bg-blue-500/10' : 'border-slate-600 hover:border-slate-400 bg-slate-800/50'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type='file'
          accept='video/*'
          className='hidden'
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {uploading ? (
          <div>
            <div className='w-16 h-16 mx-auto mb-4 rounded-full border-4 border-blue-500 border-t-transparent animate-spin' />
            <p className='text-slate-300 text-lg'>上传中... {progress}%</p>
            <div className='mt-4 w-full bg-slate-700 rounded-full h-2'>
              <div className='bg-blue-500 h-2 rounded-full transition-all' style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <div>
            <div className='text-6xl mb-4'>🎬</div>
            <p className='text-slate-300 text-xl mb-2'>拖拽视频文件到这里</p>
            <p className='text-slate-500'>或点击选择文件</p>
            <p className='text-slate-600 text-sm mt-4'>支持 MP4、MOV、AVI 等格式，最大 500MB</p>
          </div>
        )}
      </div>

      {error && (
        <div className='mt-4 px-4 py-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm'>
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className='mt-12 flex gap-4'>
        <button
          onClick={() => {
            reset()
            setActiveTab('skill')
            navigate('/playground/history')
          }}
          disabled={skillCount === 0}
          className='flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors'
        >
          <span>📚</span>
          <span>Skill 仓库</span>
          {skillCount > 0 && (
            <span className='ml-1 px-2 py-0.5 bg-blue-600 text-xs rounded-full'>
              {skillCount}
            </span>
          )}
        </button>
      </div>

      {/* Feature list */}
      <div className='mt-16 grid grid-cols-3 gap-6 max-w-2xl w-full'>
        {[
          { icon: '🎞️', title: '智能抽帧', desc: 'FFmpeg 自动提取关键帧，支持手动精选' },
          { icon: '✏️', title: '可视化标注', desc: '在帧上画箭头、标注文字，引导 AI 理解' },
          { icon: '⚡', title: 'AI 生成 Skill', desc: 'Claude 视觉模型分析，自动生成 midscene 脚本' },
        ].map((f) => (
          <div key={f.title} className='bg-slate-800/50 rounded-xl p-5 text-center'>
            <div className='text-3xl mb-2'>{f.icon}</div>
            <h3 className='text-white font-semibold mb-1'>{f.title}</h3>
            <p className='text-slate-400 text-sm'>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
