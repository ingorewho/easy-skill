import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Upload, Trash2, Image as ImageIcon, FileText, Paperclip, Pencil, Check, Loader2, BookOpen } from 'lucide-react'
import {
  fetchKnowledgeFiles,
  uploadKnowledgeFile,
  updateKnowledgeDescription,
  deleteKnowledgeFile,
  getKnowledgeDownloadUrl,
} from '../api/client.js'

const formatSize = (bytes) => {
  if (bytes == null) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const typeIcon = (fileType) => {
  if (fileType === 'image') return ImageIcon
  if (fileType === 'document') return FileText
  return Paperclip
}

export default function KnowledgeBasePanel({ skillId, onClose }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [pendingDesc, setPendingDesc] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    if (!skillId) return
    setLoading(true)
    try {
      const list = await fetchKnowledgeFiles(skillId)
      setFiles(Array.isArray(list) ? list : [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [skillId])

  useEffect(() => { load() }, [load])

  const handlePick = (e) => {
    const f = e.target.files?.[0]
    if (f) setPendingFile(f)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) setPendingFile(f)
  }

  const handleUpload = async () => {
    if (!pendingFile) return
    setUploading(true); setProgress(0); setError('')
    try {
      await uploadKnowledgeFile(skillId, pendingFile, pendingDesc, setProgress)
      setPendingFile(null); setPendingDesc('')
      await load()
    } catch (e) { setError('上传失败：' + e.message) }
    finally { setUploading(false); setProgress(0) }
  }

  const handleDelete = async (fileName) => {
    if (!confirm(`确定删除「${fileName}」？`)) return
    try {
      await deleteKnowledgeFile(skillId, fileName)
      setFiles(files.filter(f => f.fileName !== fileName))
    } catch (e) { setError('删除失败：' + e.message) }
  }

  const handleSaveDesc = async () => {
    if (!editing) return
    try {
      const updated = await updateKnowledgeDescription(skillId, editing.fileName, editing.value)
      setFiles(files.map(f => f.fileName === editing.fileName ? updated : f))
      setEditing(null)
    } catch (e) { setError('保存失败：' + e.message) }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center animate-fade-in'
         style={{ background: 'rgba(31, 28, 24, 0.35)', backdropFilter: 'blur(8px)' }}>
      <div className='w-[900px] max-w-[92vw] max-h-[86vh] flex flex-col card-paper shadow-lift overflow-hidden animate-fade-up'>
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b hairline bg-paper-50/50'>
          <div className='flex items-baseline gap-3'>
            <BookOpen className='w-4 h-4 text-umber-500 self-center' />
            <div>
              <div className='eyebrow mb-0.5'>Knowledge · 知识库</div>
              <h3 className='font-display text-[19px] text-ink-900'>运行时上下文</h3>
            </div>
          </div>
          <button onClick={onClose}
            className='w-8 h-8 rounded-full flex items-center justify-center text-ink-400 hover:text-ink-900 hover:bg-paper-200/60 transition-colors'>
            <X className='w-4 h-4' />
          </button>
        </div>

        {/* Upload area */}
        <div className='px-6 pt-5'>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative rounded-2xl border border-dashed transition-all duration-300 cursor-pointer px-6 py-7 text-center
              ${dragOver
                ? 'border-umber-500 bg-umber-50/60 -translate-y-0.5'
                : 'border-ink-900/15 hover:border-ink-900/30 bg-paper-100/40 hover:bg-paper-200/30'}`}
          >
            <input ref={inputRef} type='file' className='hidden' onChange={handlePick} />
            <div className='inline-flex items-center justify-center w-10 h-10 rounded-full bg-paper-50 ring-1 ring-ink-900/[0.06] mb-3'>
              <Upload className='w-4 h-4 text-ink-500' />
            </div>
            <div className='text-[13.5px] text-ink-700'>
              {pendingFile ? (
                <span>
                  <span className='text-umber-600 font-medium'>{pendingFile.name}</span>
                  <span className='divider-dot'></span>
                  <span className='text-ink-400 font-mono text-[11.5px]'>{formatSize(pendingFile.size)}</span>
                </span>
              ) : (
                <span>拖拽文件到此处，或 <span className='text-umber-600 font-medium'>点击选择</span></span>
              )}
            </div>
            <div className='text-[11.5px] text-ink-400 mt-2 leading-relaxed max-w-md mx-auto'>
              图片用于视觉参考 · 文档（md / txt / json 等）将注入 agent 上下文
            </div>
          </div>

          {pendingFile && (
            <div className='mt-4 flex items-center gap-2'>
              <input
                value={pendingDesc}
                onChange={(e) => setPendingDesc(e.target.value)}
                placeholder='为这份知识写一句描述（AI 会读到它）'
                className='flex-1 bg-paper-50 border border-ink-900/10 rounded-full px-4 py-2.5 text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-umber-500 transition-colors'
              />
              <button
                onClick={handleUpload}
                disabled={uploading}
                className='btn-primary disabled:opacity-60'
              >
                {uploading ? (
                  <><Loader2 className='w-3.5 h-3.5 animate-spin' />
                    <span>上传 {progress}%</span></>
                ) : (
                  <><Upload className='w-3.5 h-3.5' /><span>上传</span></>
                )}
              </button>
              <button
                onClick={() => { setPendingFile(null); setPendingDesc('') }}
                className='w-9 h-9 rounded-full flex items-center justify-center text-ink-400 hover:text-ink-900 hover:bg-paper-200/60 transition-colors'
                disabled={uploading}
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          )}

          {error && (
            <div className='mt-3 text-[12px] text-clay-700 bg-clay-500/10 border border-clay-500/25 rounded-xl px-3 py-2'>
              {error}
            </div>
          )}
        </div>

        {/* File list */}
        <div className='flex-1 overflow-y-auto px-6 py-5 scrollbar-thin'>
          {loading ? (
            <div className='text-center text-ink-400 text-sm py-8 flex items-center justify-center gap-2'>
              <Loader2 className='w-3.5 h-3.5 animate-spin' /> 加载中
            </div>
          ) : files.length === 0 ? (
            <div className='text-center py-14'>
              <div className='mx-auto w-12 h-12 rounded-full border hairline-strong flex items-center justify-center text-ink-400 mb-4'>
                <BookOpen className='w-4 h-4' />
              </div>
              <div className='text-[13px] text-ink-400 max-w-xs mx-auto leading-relaxed'>
                还没有知识文件 — 上传图片或文档让 skill 运行时更贴近真实场景
              </div>
            </div>
          ) : (
            <div className='grid grid-cols-2 gap-3'>
              {files.map((f) => {
                const Icon = typeIcon(f.fileType)
                const isImage = f.fileType === 'image'
                const url = getKnowledgeDownloadUrl(skillId, f.fileName)
                const isEditing = editing?.fileName === f.fileName
                return (
                  <div key={f.fileName}
                    className='bg-paper-50 border border-ink-900/[0.06] rounded-xl p-3 hover:border-ink-900/15 hover:shadow-soft transition-all duration-300 flex gap-3'>
                    <div className='w-[76px] h-[76px] shrink-0 rounded-lg overflow-hidden bg-paper-100 border hairline flex items-center justify-center'>
                      {isImage ? (
                        <img src={url} alt={f.fileName} className='w-full h-full object-cover' />
                      ) : (
                        <Icon className='w-6 h-6 text-ink-400' />
                      )}
                    </div>
                    <div className='flex-1 min-w-0 flex flex-col justify-between'>
                      <div>
                        <div className='flex items-center justify-between gap-2'>
                          <a href={url} target='_blank' rel='noreferrer'
                            className='text-[13px] text-ink-900 truncate hover:text-umber-600 transition-colors font-medium'
                            title={f.fileName}>
                            {f.fileName}
                          </a>
                          <button
                            onClick={() => handleDelete(f.fileName)}
                            className='text-ink-400 hover:text-clay-500 shrink-0 transition-colors'
                            title='删除'
                          >
                            <Trash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>
                        <div className='font-mono text-[10.5px] text-ink-400 mt-0.5 tracking-wide uppercase'>
                          {formatSize(f.size)} · {f.fileType}
                        </div>
                        {isEditing ? (
                          <div className='mt-2 flex items-center gap-1.5'>
                            <input
                              autoFocus
                              value={editing.value}
                              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveDesc()}
                              className='flex-1 text-[12px] bg-paper-100 border border-ink-900/10 rounded-md px-2 py-1 text-ink-900 focus:outline-none focus:border-umber-500'
                              placeholder='描述...'
                            />
                            <button onClick={handleSaveDesc} className='text-sage-700 hover:text-sage-500 transition-colors'><Check className='w-3.5 h-3.5' /></button>
                            <button onClick={() => setEditing(null)} className='text-ink-400 hover:text-ink-900 transition-colors'><X className='w-3.5 h-3.5' /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditing({ fileName: f.fileName, value: f.description || '' })}
                            className='mt-2 text-[12px] text-ink-500 hover:text-ink-900 text-left w-full flex items-center gap-1 group transition-colors'
                            title='点击编辑描述'
                          >
                            <span className='truncate flex-1'>
                              {f.description || <span className='italic text-ink-400'>未描述 · 点击添加</span>}
                            </span>
                            <Pencil className='w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity' />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='px-6 py-3 border-t hairline bg-paper-50/40 flex items-center justify-between'>
          <span className='text-[11px] text-ink-400 leading-relaxed'>
            文本注入 <code className='font-mono text-ink-700 px-1.5 py-0.5 bg-paper-200/60 rounded'>aiActContext</code>
            <span className='divider-dot'></span>
            图片可通过 <code className='font-mono text-ink-700 px-1.5 py-0.5 bg-paper-200/60 rounded'>__KNOWLEDGE__.images</code> 引用
          </span>
          <span className='font-mono text-[10.5px] text-ink-400 tracking-wider uppercase'>
            {files.length} · Files
          </span>
        </div>
      </div>
    </div>
  )
}
