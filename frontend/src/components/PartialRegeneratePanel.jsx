import { useState, useRef, useCallback, useEffect } from 'react'
import useAppStore from '../store/useAppStore.js'
import { partialRegenerateSkill } from '../api/client.js'
import FrameGridSelector from './FrameGridSelector.jsx'
import CodeRangeSelector from './CodeRangeSelector.jsx'
import { Sparkles, Image as ImageIcon, Code2, Send, X, Loader2, Lightbulb, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react'

// 生成策略选项
const MODE_OPTIONS = [
  { 
    id: 'auto', 
    label: '智能推荐', 
    description: '根据选择自动选择最佳模式',
    icon: Sparkles,
    color: 'blue'
  },
  { 
    id: 'text', 
    label: '纯文本优化', 
    description: '使用 qwen3.5-plus，适合代码调整',
    icon: Code2,
    color: 'green'
  },
  { 
    id: 'multimodal', 
    label: '多模态分析', 
    description: '使用 qwen3-vl-plus，结合截图理解',
    icon: ImageIcon,
    color: 'purple'
  }
]

// 常用提示词模板
const PROMPT_TEMPLATES = [
  { label: '添加异常处理', value: '请为这段代码添加异常处理逻辑，确保出错时能优雅降级。' },
  { label: '优化等待逻辑', value: '优化等待逻辑，使用更智能的条件等待代替固定延时。' },
  { label: '添加日志输出', value: '添加详细的日志输出，方便调试和追踪执行流程。' },
  { label: '简化代码', value: '简化这段代码，移除冗余逻辑，保持功能不变。' },
  { label: '添加重试机制', value: '为关键操作添加重试机制，提高稳定性。' },
  { label: '优化选择器', value: '优化元素选择描述，使其更精准稳定。' },
]

export default function PartialRegeneratePanel({ onClose, associatedFrames = null, associatedVideoId = null }) {
  const skillId = useAppStore(s => s.skillId)
  const skillFiles = useAppStore(s => s.skillFiles)
  const storeFrames = useAppStore(s => s.frames)
  const storeRequirement = useAppStore(s => s.requirement)
  
  // 使用关联的帧（如果有），否则使用 store 中的帧
  const frames = associatedFrames || storeFrames || []
  const requirement = associatedVideoId ? null : storeRequirement // 如果是历史skill，不强制要求当前requirement
  
  // 局部重新生成状态
  const [selectedFrameIds, setSelectedFrameIds] = useState([])
  const [selectedCodeRange, setSelectedCodeRange] = useState(null)
  const [additionalPrompt, setAdditionalPrompt] = useState('')
  const [mode, setMode] = useState('auto')
  
  // UI 状态
  const [isGenerating, setIsGenerating] = useState(false)
  const [logs, setLogs] = useState([])
  const [showTips, setShowTips] = useState(true)
  const [showTemplates, setShowTemplates] = useState(false)
  const [estimatedTokens, setEstimatedTokens] = useState(0)
  const [isMaximized, setIsMaximized] = useState(false)
  
  const logsContainerRef = useRef(null)

  // 帧来源信息
  const frameSource = associatedFrames
    ? 'skill'
    : storeFrames?.length > 0
      ? 'current'
      : 'none'

  // 自动滚动日志：仅滚动日志容器自身，且只在用户已贴底时跟随
  useEffect(() => {
    const el = logsContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 80) {
      el.scrollTop = el.scrollHeight
    }
  }, [logs])
  
  // 计算推荐模式
  const recommendedMode = useCallback(() => {
    const hasImages = selectedFrameIds.length > 0
    const hasCodeRange = selectedCodeRange !== null
    
    if (hasImages && hasCodeRange) return 'multimodal'
    if (hasImages) return 'multimodal'
    if (hasCodeRange) return 'text'
    return 'text'
  }, [selectedFrameIds, selectedCodeRange])
  
  // 实际使用的模式
  const effectiveMode = mode === 'auto' ? recommendedMode() : mode
  
  // 估算 token 消耗
  useEffect(() => {
    let tokens = 500 // 基础系统提示词
    tokens += additionalPrompt.length / 4
    
    if (selectedCodeRange) {
      const mainJs = skillFiles.find(f => f.path === 'scripts/main.js')?.content || ''
      const lines = mainJs.split('\n')
      const selectedLines = lines.slice(
        selectedCodeRange.start - 1, 
        selectedCodeRange.end
      ).join('\n')
      tokens += selectedLines.length / 4
    } else {
      tokens += 2000 // 完整代码
    }
    
    tokens += selectedFrameIds.length * 500 // 每张图约500 tokens（压缩后）
    
    setEstimatedTokens(Math.round(tokens))
  }, [additionalPrompt, selectedCodeRange, selectedFrameIds, skillFiles])
  
  // 处理帧选择
  const handleFrameToggle = (frameId) => {
    setSelectedFrameIds(prev => {
      if (prev.includes(frameId)) {
        return prev.filter(id => id !== frameId)
      }
      if (prev.length >= 2) {
        return [prev[1], frameId] // 替换最早的选择
      }
      return [...prev, frameId]
    })
  }
  
  // 处理代码范围选择
  const handleCodeRangeSelect = (range) => {
    setSelectedCodeRange(range)
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
  
  // 开始局部重新生成
  const handleGenerate = async () => {
    if (!additionalPrompt.trim()) {
      alert('请输入补充要求')
      return
    }
    
    setIsGenerating(true)
    setLogs([])
    
    try {
      // 获取选中的帧数据
      const selectedFrames = frames
        .filter(f => selectedFrameIds.includes(f.frameId))
        .map(f => ({
          frameId: f.frameId,
          timestamp: f.timestamp,
          description: f.description,
          base64Image: f.base64Image,
          annotationJson: f.annotationJson
        }))
      
      const response = await partialRegenerateSkill(skillId, {
        requirement,
        additionalPrompt,
        selectedFrameIds: selectedFrameIds.length > 0 ? selectedFrameIds : null,
        selectedFrames: selectedFrames.length > 0 ? selectedFrames : null,
        selectedCodeRange,
        mode: effectiveMode
      }, (msg) => {
        setLogs(prev => [...prev, msg])
      })
      
      // 更新 store 中的候选代码
      useAppStore.setState({
        regeneration: {
          ...useAppStore.getState().regeneration,
          candidate: response.candidate,
          current: response.current,
          history: response.history,
          iteration: response.iteration,
          showComparison: true,
          isRegenerating: false
        }
      })
      
      onClose()
    } catch (e) {
      setLogs(prev => [...prev, `❌ 错误：${e.message}`])
    } finally {
      setIsGenerating(false)
    }
  }
  
  // 清除所有选择
  const clearAll = () => {
    setSelectedFrameIds([])
    setSelectedCodeRange(null)
    setAdditionalPrompt('')
  }
  
  // 获取当前 main.js 内容
  const mainJsContent = skillFiles.find(f => f.path === 'scripts/main.js')?.content || ''
  
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
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">局部重新生成</h2>
              <p className="text-slate-400 text-sm">精准调整代码，支持图片参考 + 代码范围选择</p>
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
                  <li>• 只输入文字 → 全局调整代码（快速文本模式）</li>
                  <li>• 选择代码行 → 局部精准修改（仅修改选中部分）</li>
                  <li>• 添加1-2张图 → 结合界面理解操作（多模态模式）</li>
                  <li>• 图+代码 → 最精准的局部调整（推荐用于复杂场景）</li>
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
        
        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex">
          
          {/* Left: Frame Selection */}
          <div className="w-72 border-r border-slate-800 flex flex-col">
            <div className="px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300 font-medium">参考图片</span>
                <span className="text-xs text-slate-500">(可选0-2张)</span>
              </div>
              <p className="text-xs text-slate-500">
                {frames.length === 0 
                  ? '暂无可选图片，可使用纯文本模式'
                  : selectedFrameIds.length === 0 
                    ? '未选择图片（可选），将使用纯文本模式'
                    : `已选择 ${selectedFrameIds.length}/2 张图片`
                }
              </p>
              {/* 帧来源指示器 */}
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
            </div>
          </div>
          
          {/* Center: Code Selection */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300 font-medium">代码范围</span>
                <span className="text-xs text-slate-500">(可选)</span>
              </div>
              {selectedCodeRange && (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                    第{selectedCodeRange.start}-{selectedCodeRange.end}行
                  </span>
                  <button
                    onClick={() => setSelectedCodeRange(null)}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    清除
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-hidden">
              <CodeRangeSelector
                code={mainJsContent}
                selectedRange={selectedCodeRange}
                onSelect={handleCodeRangeSelect}
              />
            </div>
          </div>
          
          {/* Right: Prompt & Settings */}
          <div className="w-96 flex flex-col bg-slate-900/50">
            
            {/* Mode Selection */}
            <div className="px-4 py-3 border-b border-slate-800">
              <label className="text-xs text-slate-500 uppercase tracking-wider mb-3 block">
                生成策略
              </label>
              <div className="space-y-2">
                {MODE_OPTIONS.map(option => {
                  const Icon = option.icon
                  const isRecommended = mode === 'auto' && effectiveMode === option.id
                  const isSelected = mode === option.id
                  
                  return (
                    <button
                      key={option.id}
                      onClick={() => setMode(option.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        isSelected
                          ? `border-${option.color}-500 bg-${option.color}-500/10`
                          : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-${option.color}-500/20 flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 text-${option.color}-400`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${isSelected ? `text-${option.color}-400` : 'text-slate-300'}`}>
                            {option.label}
                          </span>
                          {isRecommended && (
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                              推荐
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            
            {/* Prompt Input */}
            <div className="flex-1 flex flex-col p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider">
                  修改要求
                </label>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  常用提示词
                  {showTemplates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
              
              {/* Templates Dropdown */}
              {showTemplates && (
                <div className="mb-3 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
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
                placeholder="请描述你想要做的修改...\n例如：优化这段代码的异常处理，添加重试机制"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-500 resize-none focus:border-blue-500 focus:outline-none transition-colors"
              />
              
              {/* Stats */}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>预估消耗: ~{estimatedTokens} tokens</span>
                <span>{additionalPrompt.length} 字符</span>
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
                  onClick={clearAll}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
                  disabled={isGenerating}
                >
                  清除选择
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!additionalPrompt.trim() || isGenerating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      开始重新生成
                    </>
                  )}
                </button>
              </div>
              
              {/* Summary */}
              <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                {selectedFrameIds.length > 0 && (
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    {selectedFrameIds.length} 张图片
                  </span>
                )}
                {selectedCodeRange && (
                  <span className="flex items-center gap-1">
                    <Code2 className="w-3 h-3" />
                    第{selectedCodeRange.start}-{selectedCodeRange.end}行
                  </span>
                )}
                <span className={`flex items-center gap-1 ${
                  effectiveMode === 'multimodal' ? 'text-purple-400' : 'text-green-400'
                }`}>
                  <Sparkles className="w-3 h-3" />
                  {effectiveMode === 'multimodal' ? '多模态' : '纯文本'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
