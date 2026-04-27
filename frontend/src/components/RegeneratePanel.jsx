import { useState, useRef, useEffect } from 'react'
import useAppStore from '../store/useAppStore.js'
import { regenerateSkill, acceptCandidate, discardCandidate, fetchSkillVersions } from '../api/client.js'
import FrameGridSelector from './FrameGridSelector.jsx'
import CodeComparisonView from './CodeComparisonView.jsx'
import { 
  Sparkles, X, Loader2, Lightbulb, Maximize2, Minimize2, 
  History, Check, Trash2, ChevronDown, Send, FileCode
} from 'lucide-react'

// 常用提示词模板
const PROMPT_TEMPLATES = [
  { label: '添加异常处理', value: '请添加异常处理逻辑，确保出错时能优雅降级。' },
  { label: '优化等待逻辑', value: '优化等待逻辑，使用更智能的条件等待代替固定延时。' },
  { label: '添加日志输出', value: '添加详细的日志输出，方便调试和追踪执行流程。' },
  { label: '简化代码', value: '简化这段代码，移除冗余逻辑，保持功能不变。' },
  { label: '添加重试机制', value: '为关键操作添加重试机制，提高稳定性。' },
  { label: '优化选择器', value: '优化元素选择描述，使其更精准稳定。' },
  { label: '修复潜在bug', value: '检查并修复代码中潜在的bug和边界情况。' },
  { label: '提升性能', value: '优化代码性能，减少不必要的操作和等待。' },
]

export default function RegeneratePanel({ onClose, associatedFrames = null }) {
  const store = useAppStore()
  const {
    skillId,
    skillName,
    skillFiles,
    frames: storeFrames,
    requirement,
    regeneration,
    setAdditionalPrompt,
    startRegeneration,
    setRegenerationCandidate,
    acceptCandidate: acceptCandidateAction,
    discardCandidate: discardCandidateAction,
    setShowComparison,
  } = store

  // 使用关联的帧或当前会话的帧
  const frames = associatedFrames || storeFrames || []
  const frameSource = associatedFrames ? 'skill' : storeFrames?.length > 0 ? 'current' : 'none'

  const [activeFile, setActiveFile] = useState('scripts/main.js')
  const [historyVersions, setHistoryVersions] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [showTips, setShowTips] = useState(true)
  const [showTemplates, setShowTemplates] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [logs, setLogs] = useState([])
  const [selectedFrameIds, setSelectedFrameIds] = useState([])
  
  const { candidate, history, iteration, additionalPrompt, isRegenerating } = regeneration
  const logsContainerRef = useRef(null)

  // 默认选中所有帧
  useEffect(() => {
    if (frames.length > 0) {
      setSelectedFrameIds(frames.map(f => f.frameId))
    }
  }, [frames])

  // 处理帧选择
  const handleFrameToggle = (frameId) => {
    setSelectedFrameIds(prev => {
      if (prev.includes(frameId)) {
        return prev.filter(id => id !== frameId)
      }
      if (prev.length >= 2) {
        return [prev[1], frameId]
      }
      return [...prev, frameId]
    })
  }

  // 自动滚动日志：仅滚动日志容器自身，且只在用户已贴底时跟随
  useEffect(() => {
    const el = logsContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 80) {
      el.scrollTop = el.scrollHeight
    }
  }, [logs])

  // 加载历史版本
  useEffect(() => {
    if (skillId) {
      loadHistory()
    }
  }, [skillId])

  const loadHistory = async () => {
    try {
      const versions = await fetchSkillVersions(skillId)
      setHistoryVersions(versions || [])
    } catch (e) {
      console.error('Failed to load versions:', e)
    }
  }

  // 获取当前和候选的文件内容
  const currentFile = skillFiles.find(f => f.path === activeFile)
  const candidateFile = candidate?.files?.find(f => f.path === activeFile)

  // 获取所有可用的文件路径
  const allFilePaths = [...new Set([
    ...skillFiles.map(f => f.path),
    ...(candidate?.files?.map(f => f.path) || [])
  ])].filter(path => path.endsWith('.js') || path.endsWith('.md') || path.endsWith('.json'))

  // 执行重新生成
  const handleRegenerate = async () => {
    if (!skillId) return
    
    setLogs([])
    startRegeneration()
    
    try {
      // 建立 SSE 连接
      const sessionId = `regen-${Date.now()}`
      const eventSource = new EventSource(`/api/skills/logs/${sessionId}`)
      
      eventSource.onmessage = (event) => {
        setLogs(prev => [...prev, event.data])
      }
      
      eventSource.onerror = () => {
        eventSource.close()
      }

      // 准备帧数据 - 使用选中的帧或全部帧
      const framesToUse = selectedFrameIds.length > 0 
        ? frames.filter(f => selectedFrameIds.includes(f.frameId))
        : frames
      
      const framesData = framesToUse.map(f => ({
        frameId: f.frameId,
        timestamp: f.timestamp,
        base64Image: f.base64Image,
        description: f.description,
        annotationJson: f.annotationJson
      }))

      // 调用 API - 使用多模态模式
      const response = await regenerateSkill(skillId, {
        sessionId,
        requirement,
        additionalPrompt,
        frames: framesData,
        mode: 'multimodal'  // 强制使用多模态模型
      })

      eventSource.close()

      // 更新状态
      setRegenerationCandidate(
        response.candidate,
        response.history,
        response.iteration
      )
      
      setHistoryVersions(response.history)
    } catch (e) {
      console.error('Regeneration failed:', e)
      setLogs(prev => [...prev, `❌ 错误：${e.message || '重新生成失败'}`])
    }
  }

  // 接受候选
  const handleAccept = async () => {
    if (!skillId || !candidate) return
    
    try {
      await acceptCandidate(skillId)
      acceptCandidateAction()
      onClose()
    } catch (e) {
      alert('接受失败: ' + e.message)
    }
  }

  // 放弃候选
  const handleDiscard = async () => {
    if (!skillId) return
    
    try {
      await discardCandidate(skillId)
      discardCandidateAction()
    } catch (e) {
      alert('放弃失败: ' + e.message)
    }
  }

  // 应用提示词模板
  const applyTemplate = (template) => {
    setAdditionalPrompt(prev => {
      if (prev.trim()) {
        return prev + '\n' + template.value
      }
      return template.value
    })
    setShowTemplates(false)
  }

  // 如果没有候选代码，显示重新生成面板
  if (!candidate) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className={`bg-slate-900 border border-slate-700 rounded-2xl w-full flex flex-col shadow-2xl transition-all duration-300 ${
          isMaximized 
            ? 'fixed inset-0 max-w-none max-h-none rounded-none' 
            : 'max-w-6xl max-h-[90vh]'
        }`}>
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">重新生成 Skill</h2>
                <p className="text-slate-400 text-sm">基于补充要求生成新版本的 Skill</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTips(!showTips)}
                className="p-2 text-slate-400 hover:text-yellow-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="使用技巧"
              >
                <Lightbulb className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                title={isMaximized ? '退出全屏' : '全屏'}
              >
                {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tips Banner */}
          {showTips && (
            <div className="bg-blue-500/10 border-b border-blue-500/20 px-6 py-3">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-sm text-blue-200">
                  <p className="font-medium mb-1">💡 使用技巧</p>
                  <ul className="space-y-1 text-blue-300/80">
                    <li>• 重新生成会基于原始诉求和补充要求生成新版本</li>
                    <li>• 可以选择使用关联的图片帧（如果可用）进行多模态生成</li>
                    <li>• 不选图片时将使用纯文本模式（qwen3.5-plus），速度更快</li>
                    <li>• 生成后可对比新旧版本，选择接受或放弃</li>
                  </ul>
                </div>
                <button 
                  onClick={() => setShowTips(false)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Main Content - Three Columns */}
          <div className="flex-1 overflow-hidden flex">
            
            {/* Left: Frame Selection */}
            <div className="w-72 border-r border-slate-800 flex flex-col">
              <div className="px-4 py-3 border-b border-slate-800">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300 font-medium">参考图片</span>
                  <span className="text-xs text-slate-500">(可选0-2张)</span>
                </div>
                <p className="text-xs text-slate-500">
                  {frames.length === 0 
                    ? '暂无可选图片，将使用纯文本模式'
                    : '选择图片进行多模态生成'
                  }
                </p>
                {frameSource !== 'none' && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">来源:</span>
                    {frameSource === 'skill' ? (
                      <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                        Skill关联帧
                      </span>
                    ) : (
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                        当前会话帧
                      </span>
                    )}
                    <span className="text-[10px] text-slate-600">{frames.length} 帧可用</span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-3">
                <FrameGridSelector
                  frames={frames}
                  selectedIds={selectedFrameIds}
                  onToggle={handleFrameToggle}
                  maxSelection={2}
                />
                {frames.length > 0 && selectedFrameIds.length === 0 && (
                  <p className="text-xs text-slate-500 mt-3 text-center">
                    未选择图片，将使用纯文本模式
                  </p>
                )}
              </div>
            </div>

            {/* Center: Current Code Preview */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300 font-medium">当前代码</span>
                </div>
                <select
                  value={activeFile}
                  onChange={(e) => setActiveFile(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300"
                >
                  {allFilePaths.map(path => (
                    <option key={path} value={path}>{path}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1 overflow-auto p-4 bg-slate-950">
                {currentFile ? (
                  <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap">
                    {currentFile.content}
                  </pre>
                ) : (
                  <div className="text-xs text-slate-600">文件不存在</div>
                )}
              </div>
            </div>

            {/* Right: Prompt & Settings */}
            <div className="w-96 flex flex-col bg-slate-900/50">
              
              {/* Original Requirement */}
              <div className="px-4 py-3 border-b border-slate-800">
                <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">
                  原始诉求
                </label>
                <div className="bg-slate-800/50 rounded-lg p-3 text-sm text-slate-400 max-h-24 overflow-y-auto">
                  {requirement || '（未设置诉求）'}
                </div>
              </div>

              {/* Additional Prompt */}
              <div className="flex-1 flex flex-col p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-500 uppercase tracking-wider">
                    补充要求
                  </label>
                  <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    常用提示词
                    {showTemplates ? <ChevronDown className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 rotate-180" />}
                  </button>
                </div>
                
                {/* Templates Dropdown */}
                {showTemplates && (
                  <div className="mb-3 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    {PROMPT_TEMPLATES.map((template, idx) => (
                      <button
                        key={idx}
                        onClick={() => applyTemplate(template)}
                        className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                )}
                
                <textarea
                  value={additionalPrompt}
                  onChange={(e) => setAdditionalPrompt(e.target.value)}
                  placeholder="请描述你想要做的修改...&#10;例如：添加异常处理、优化等待逻辑等"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-500 resize-none focus:border-blue-500 focus:outline-none transition-colors"
                />
                
                {/* Stats */}
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{additionalPrompt.length} 字符</span>
                  <span>第 {iteration + 1} 次迭代</span>
                </div>
              </div>

              {/* Logs */}
              {logs.length > 0 && (
                <div ref={logsContainerRef} className="h-32 border-t border-slate-800 bg-slate-950 p-3 overflow-y-auto font-mono text-xs">
                  {logs.map((log, idx) => (
                    <div key={idx} className="text-slate-400 mb-1">{log}</div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="p-4 border-t border-slate-800 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
                    disabled={isRegenerating}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating || !additionalPrompt.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all"
                  >
                    {isRegenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        重新生成
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 有候选代码，显示对比视图（简化版，嵌入当前面板）
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-slate-900 border border-slate-700 rounded-2xl w-full flex flex-col shadow-2xl transition-all duration-300 ${
        isMaximized 
          ? 'fixed inset-0 max-w-none max-h-none rounded-none' 
          : 'max-w-6xl max-h-[90vh]'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">生成完成 - 请确认</h2>
              <p className="text-slate-400 text-sm">第 {iteration} 次迭代</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
              title={isMaximized ? '退出全屏' : '全屏'}
            >
              {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Comparison View */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* File Selector */}
          <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-4">
            <span className="text-xs text-slate-500 uppercase tracking-wider">对比文件</span>
            <select
              value={activeFile}
              onChange={(e) => setActiveFile(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300"
            >
              {allFilePaths.map(path => (
                <option key={path} value={path}>{path}</option>
              ))}
            </select>
            
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <History className="w-4 h-4" />
              历史版本
              {historyVersions.length > 0 && (
                <span className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded text-xs">
                  {historyVersions.length}
                </span>
              )}
            </button>
          </div>

          {/* History Dropdown */}
          {showHistory && (
            <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/50">
              <div className="flex gap-2 overflow-x-auto">
                {historyVersions.length === 0 ? (
                  <span className="text-xs text-slate-600">暂无历史版本</span>
                ) : (
                  historyVersions.map(v => (
                    <div
                      key={v.versionNumber}
                      className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-400 whitespace-nowrap"
                      title={v.additionalPrompt}
                    >
                      V{v.versionNumber} · {v.acceptedAt?.slice(0, 10)}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Code Comparison */}
          <div className="flex-1 grid grid-cols-2 divide-x divide-slate-800 overflow-hidden">
            {/* Current */}
            <div className="flex flex-col min-h-0">
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800">
                <span className="text-xs font-medium text-slate-500">
                  当前生效 {iteration > 1 ? `(V${iteration - 1})` : ''}
                </span>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {currentFile ? (
                  <pre className="text-xs font-mono text-slate-500 whitespace-pre-wrap">
                    {currentFile.content}
                  </pre>
                ) : (
                  <div className="text-xs text-slate-600">文件不存在</div>
                )}
              </div>
            </div>

            {/* Candidate */}
            <div className="flex flex-col min-h-0">
              <div className="px-4 py-2 bg-blue-900/20 border-b border-slate-800">
                <span className="text-xs font-medium text-blue-400">
                  候选 V{iteration}
                </span>
                {candidate?.skillName !== skillName && (
                  <span className="ml-2 text-xs text-slate-500">
                    {candidate?.skillName}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-auto p-4">
                {candidateFile ? (
                  <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">
                    {candidateFile.content}
                  </pre>
                ) : (
                  <div className="text-xs text-slate-600">文件不存在</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex gap-2">
            <button
              onClick={handleDiscard}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              放弃
            </button>
            <button
              onClick={() => {
                discardCandidateAction()
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
            >
              📝 修改要求
            </button>
          </div>

          <button
            onClick={handleAccept}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Check className="w-4 h-4" />
            接受 V{iteration}
          </button>
        </div>
      </div>
    </div>
  )
}
