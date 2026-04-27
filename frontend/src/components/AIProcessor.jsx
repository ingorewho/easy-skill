import { useState, useRef } from 'react'
import useAppStore from '../store/useAppStore.js'
import { generateSkill } from '../api/client.js'

export default function AIProcessor() {
  const videoId = useAppStore(s => s.videoId)
  const frames = useAppStore(s => s.frames)
  const requirement = useAppStore(s => s.requirement)
  const isGenerating = useAppStore(s => s.isGenerating)
  const setIsGenerating = useAppStore(s => s.setIsGenerating)
  const setSkill = useAppStore(s => s.setSkill)
  const setActiveTab = useAppStore(s => s.setActiveTab)

  const [logs, setLogs] = useState([])
  const [error, setError] = useState(null)
  const esRef = useRef(null)

  const canGenerate = frames.length > 0 && requirement.trim().length > 0 && !isGenerating

  const handleGenerate = async () => {
    if (!canGenerate) return
    setError(null)
    setLogs([])
    setIsGenerating(true)

    // 生成 sessionId，先建立 SSE 连接
    const sessionId = crypto.randomUUID()

    await new Promise((resolve) => {
      const es = new EventSource(`/api/skills/logs/${sessionId}`)
      esRef.current = es

      es.onopen = () => resolve()  // SSE 连接建立后再发请求

      es.onmessage = (e) => {
        setLogs(prev => [...prev, e.data])
      }

      es.onerror = () => {
        es.close()
        resolve()  // 出错也继续
      }

      // 兜底：500ms 后也继续
      setTimeout(resolve, 500)
    })

    try {
      const skill = await generateSkill({
        videoId,
        requirement,
        sessionId,
        frames: frames.map(f => ({
          frameId: f.frameId,
          timestamp: f.timestamp,
          base64Image: f.base64Image,
          description: f.description || '',
          annotationJson: f.annotationJson || '',
        })),
      })
      setSkill(skill.skillId, skill.skillName, skill.files, skill.variables)
      setActiveTab('skill')
    } catch (e) {
      setError(e.message)
    } finally {
      setIsGenerating(false)
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
    }
  }

  return (
    <div className='space-y-3'>
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={`w-full py-3 rounded-xl font-semibold text-base transition-all
          ${canGenerate
            ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-lg shadow-blue-900/50'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
      >
        {isGenerating ? (
          <span className='flex items-center justify-center gap-2'>
            <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
            AI 正在分析...
          </span>
        ) : '🤖 生成 Skill'}
      </button>

      {!frames.length && (
        <p className='text-slate-500 text-xs text-center'>请先提取帧</p>
      )}
      {frames.length > 0 && !requirement.trim() && (
        <p className='text-slate-500 text-xs text-center'>请填写用户诉求</p>
      )}

      {/* 日志输出区 */}
      {(logs.length > 0 || isGenerating) && (
        <div className='bg-slate-900 border border-slate-700 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1'>
          {logs.map((line, i) => (
            <div key={i} className='text-xs text-slate-300 font-mono leading-relaxed'>
              {line}
            </div>
          ))}
          {isGenerating && (
            <div className='text-xs text-slate-500 font-mono animate-pulse'>▌</div>
          )}
        </div>
      )}

      {error && (
        <div className='px-3 py-2 bg-red-900/40 border border-red-600/50 rounded-lg text-red-300 text-sm'>
          {error}
        </div>
      )}
    </div>
  )
}
