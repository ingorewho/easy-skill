import { useState, useCallback, useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import useAppStore from '../store/useAppStore.js'
import { updateSkillFile, getSkill } from '../api/client.js'
import CodeComparisonView from './CodeComparisonView.jsx'
import PartialRegeneratePanel from './PartialRegeneratePanel.jsx'
import RegeneratePanel from './RegeneratePanel.jsx'
import KnowledgeBasePanel from './KnowledgeBasePanel.jsx'
import { Scissors, RefreshCw, BookOpen } from 'lucide-react'

export default function SkillEditor() {
  const skillId = useAppStore(s => s.skillId)
  const skillName = useAppStore(s => s.skillName)
  const skillFiles = useAppStore(s => s.skillFiles)
  const updateSkillFileContent = useAppStore(s => s.updateSkillFileContent)
  const regeneration = useAppStore(s => s.regeneration)
  const editorContainerRef = useRef(null)
  const editorRef = useRef(null)

  const [activePath, setActivePath] = useState(skillFiles[0]?.path || null)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)
  const [showPartialPanel, setShowPartialPanel] = useState(false)
  const [showRegeneratePanel, setShowRegeneratePanel] = useState(false)
  const [showKnowledgePanel, setShowKnowledgePanel] = useState(false)
  const [associatedFrames, setAssociatedFrames] = useState(null)
  const [associatedVideoId, setAssociatedVideoId] = useState(null)
  const [isLoadingFrames, setIsLoadingFrames] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    if (!editorContainerRef.current) return
    const resizeObserver = new ResizeObserver(() => {
      if (editorRef.current) {
        requestAnimationFrame(() => editorRef.current.layout())
      }
    })
    resizeObserver.observe(editorContainerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (skillId && showPartialPanel) loadAssociatedFrames()
  }, [skillId, showPartialPanel])

  const loadAssociatedFrames = async () => {
    setIsLoadingFrames(true)
    try {
      const skill = await getSkill(skillId)
      if (skill.frames && skill.frames.length > 0) {
        setAssociatedFrames(skill.frames)
        setAssociatedVideoId(skill.videoId)
      } else {
        setAssociatedFrames(null); setAssociatedVideoId(null)
      }
    } catch (e) {
      console.error('Failed to load associated frames:', e)
      setAssociatedFrames(null); setAssociatedVideoId(null)
    } finally { setIsLoadingFrames(false) }
  }

  const activeFile = skillFiles.find(f => f.path === activePath)
  const { candidate } = regeneration

  const getLanguage = (path) => {
    if (!path) return 'plaintext'
    if (path.endsWith('.js')) return 'javascript'
    if (path.endsWith('.py')) return 'python'
    if (path.endsWith('.md')) return 'markdown'
    if (path.endsWith('.json')) return 'json'
    return 'plaintext'
  }

  const handleChange = useCallback((value) => {
    if (!activePath || !skillId) return
    updateSkillFileContent(activePath, value)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true); setSaveStatus(null)
      try {
        await updateSkillFile(skillId, activePath, value)
        setSaveStatus('saved')
      } catch (_) { setSaveStatus('error') }
      finally { setSaving(false) }
    }, 1000)
  }, [activePath, skillId])

  if (!skillId || skillFiles.length === 0) {
    return (
      <div className='flex items-center justify-center h-full text-ink-400 text-sm'>
        暂无 Skill 文件
      </div>
    )
  }

  return (
    <div className='h-full flex flex-col gap-3'>
      {/* Toolbar */}
      <div className='flex items-center justify-between px-1'>
        <div className='flex items-baseline gap-3'>
          <span className='eyebrow'>Editor</span>
          <span className='font-display text-[17px] text-ink-900 leading-none'>
            {skillName}
          </span>
          {regeneration.iteration > 0 && (
            <span className='font-mono text-[10.5px] text-ink-400 tracking-wider
                             px-2 py-0.5 rounded-full bg-paper-200/70 border border-ink-900/5'>
              V{regeneration.iteration + 1}
            </span>
          )}
        </div>

        <div className='flex items-center gap-2'>
          <button
            onClick={() => setShowKnowledgePanel(true)}
            className='btn-ghost hover:border-sage-500/50'
            title='上传图片/文档作为 skill 运行时的背景知识'
          >
            <BookOpen className='w-3.5 h-3.5' />
            <span>知识库</span>
          </button>

          <button
            onClick={() => setShowPartialPanel(true)}
            className='btn-ghost hover:border-umber-500/40'
            title='选择图片和代码范围进行精准调整'
          >
            <Scissors className='w-3.5 h-3.5' />
            <span>局部调整</span>
          </button>

          <button
            onClick={() => setShowRegeneratePanel(true)}
            className={`btn-ghost transition-all
              ${showRegeneratePanel || candidate
                ? 'bg-ink-900 text-paper-50 border-ink-900 hover:bg-umber-600'
                : 'hover:border-ink-900/25'}`}
          >
            <RefreshCw className='w-3.5 h-3.5' />
            <span>重新生成</span>
            {regeneration.iteration > 0 && (
              <span className='font-mono text-[10px] opacity-70'>({regeneration.iteration})</span>
            )}
          </button>
        </div>
      </div>

      {showPartialPanel && (
        <PartialRegeneratePanel
          onClose={() => setShowPartialPanel(false)}
          associatedFrames={associatedFrames}
          associatedVideoId={associatedVideoId}
        />
      )}
      {showRegeneratePanel && (
        <RegeneratePanel
          onClose={() => setShowRegeneratePanel(false)}
          associatedFrames={associatedFrames}
        />
      )}
      {showKnowledgePanel && (
        <KnowledgeBasePanel
          skillId={skillId}
          onClose={() => setShowKnowledgePanel(false)}
        />
      )}
      {regeneration.candidate && (
        <CodeComparisonView onClose={() => {}} />
      )}

      {/* Editor shell */}
      <div className='flex-1 flex rounded-2xl overflow-hidden border border-ink-900/[0.08] bg-paper-50 shadow-soft min-h-0'>
        {/* File tree */}
        <div className='w-52 bg-paper-100/60 border-r hairline flex flex-col'>
          <div className='px-4 py-3 border-b hairline'>
            <div className='eyebrow'>Files · 文件</div>
          </div>
          <div className='flex-1 overflow-y-auto scrollbar-thin py-2'>
            {skillFiles.map(file => (
              <button
                key={file.path}
                onClick={() => setActivePath(file.path)}
                className={`w-full text-left px-4 py-2 text-[13px] flex items-center gap-2.5 transition-colors
                  ${activePath === file.path
                    ? 'bg-paper-50 text-ink-900 border-l-2 border-umber-500'
                    : 'text-ink-500 hover:bg-paper-200/50 hover:text-ink-900 border-l-2 border-transparent'}`}
              >
                <span className='text-[11px] opacity-70'>{getFileIcon(file.name)}</span>
                <span className='truncate'>{file.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className='flex-1 flex flex-col min-h-0'>
          <div className='flex items-center justify-between px-5 py-2.5 border-b hairline bg-paper-50'>
            <span className='font-mono text-[12px] text-ink-500 tracking-wide'>{activePath}</span>
            <span className='font-mono text-[10.5px] tracking-wider'>
              {saving ? (
                <span className='text-ink-400 inline-flex items-center gap-1.5'>
                  <span className='w-1.5 h-1.5 rounded-full bg-umber-500 animate-pulse'></span>
                  SAVING
                </span>
              ) : saveStatus === 'saved' ? (
                <span className='text-sage-500 inline-flex items-center gap-1.5'>
                  <span className='w-1.5 h-1.5 rounded-full bg-sage-500'></span>
                  SAVED
                </span>
              ) : saveStatus === 'error' ? (
                <span className='text-clay-500'>· ERROR</span>
              ) : (
                <span className='text-ink-200'>—</span>
              )}
            </span>
          </div>

          {activeFile && (
            <div ref={editorContainerRef} className='flex-1 min-h-0 relative' style={{ minHeight: 0 }}>
              <Editor
                height='100%' width='100%'
                language={getLanguage(activePath)}
                value={activeFile.content}
                onChange={handleChange}
                theme='vs'
                onMount={(editor) => {
                  editorRef.current = editor
                  requestAnimationFrame(() => editor.layout())
                }}
                beforeUnmount={() => { editorRef.current = null }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineHeight: 1.75,
                  fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace',
                  fontLigatures: true,
                  padding: { top: 16, bottom: 16 },
                  scrollBeyondLastLine: true,
                  wordWrap: 'on',
                  automaticLayout: false,
                  renderLineHighlight: 'none',
                  scrollbar: { alwaysConsumeMouseWheel: true },
                  guides: { indentation: false },
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getFileIcon(name) {
  if (name.endsWith('.md')) return '◇'
  if (name.endsWith('.js')) return '●'
  if (name.endsWith('.py')) return '◆'
  if (name === 'package.json') return '▣'
  if (name === 'variables.json') return '◈'
  return '○'
}
