import { useState, useCallback, useRef } from 'react'
import Editor from '@monaco-editor/react'
import useAppStore from '../store/useAppStore.js'
import { updateSkillFile } from '../api/client.js'

export default function SkillEditor() {
  const skillId = useAppStore(s => s.skillId)
  const skillName = useAppStore(s => s.skillName)
  const skillFiles = useAppStore(s => s.skillFiles)
  const updateSkillFileContent = useAppStore(s => s.updateSkillFileContent)

  const [activePath, setActivePath] = useState(skillFiles[0]?.path || null)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // 'saved' | 'error'
  const saveTimer = useRef(null)

  const activeFile = skillFiles.find(f => f.path === activePath)

  const getLanguage = (path) => {
    if (!path) return 'plaintext'
    if (path.endsWith('.js')) return 'javascript'
    if (path.endsWith('.py')) return 'python'
    if (path.endsWith('.md')) return 'markdown'
    return 'plaintext'
  }

  const handleChange = useCallback((value) => {
    if (!activePath || !skillId) return
    updateSkillFileContent(activePath, value)

    // Debounced auto-save
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      setSaveStatus(null)
      try {
        await updateSkillFile(skillId, activePath, value)
        setSaveStatus('saved')
      } catch (_) {
        setSaveStatus('error')
      } finally {
        setSaving(false)
      }
    }, 1000)
  }, [activePath, skillId])

  if (!skillId || skillFiles.length === 0) {
    return (
      <div className='flex items-center justify-center h-full text-slate-500'>
        暂无 Skill 文件
      </div>
    )
  }

  return (
    <div className='h-full flex rounded-xl overflow-hidden border border-slate-700'>
      {/* File tree */}
      <div className='w-48 bg-slate-900 border-r border-slate-700 flex flex-col'>
        <div className='px-3 py-2 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700'>
          {skillName || 'skill'}
        </div>
        <div className='flex-1 overflow-y-auto py-1'>
          {skillFiles.map(file => (
            <button
              key={file.path}
              onClick={() => setActivePath(file.path)}
              className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors
                ${activePath === file.path
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <span className='text-xs'>{file.path.includes('/') ? '  ' : ''}{getFileIcon(file.name)}</span>
              <span className='truncate'>{file.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className='flex-1 flex flex-col'>
        {/* Tab bar */}
        <div className='flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-700'>
          <span className='text-slate-300 text-sm'>{activePath}</span>
          <span className='text-xs text-slate-500'>
            {saving ? '保存中...' : saveStatus === 'saved' ? '✓ 已保存' : saveStatus === 'error' ? '✗ 保存失败' : ''}
          </span>
        </div>

        {activeFile && (
          <Editor
            height='100%'
            language={getLanguage(activePath)}
            value={activeFile.content}
            onChange={handleChange}
            theme='vs-dark'
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineHeight: 1.6,
              padding: { top: 12 },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
            }}
          />
        )}
      </div>
    </div>
  )
}

function getFileIcon(name) {
  if (name.endsWith('.md')) return '📝'
  if (name.endsWith('.js')) return '🟨'
  if (name.endsWith('.py')) return '🐍'
  if (name === 'package.json') return '📦'
  return '📄'
}
