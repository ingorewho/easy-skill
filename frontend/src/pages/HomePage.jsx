import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  uploadVideo,
  fetchSkillList,
  fetchVideoArchives,
  fetchFrameArchives,
  fetchFramesByVideo,
  importSkill,
} from '../api/client.js'
import useAppStore from '../store/useAppStore.js'

export default function HomePage() {
  const navigate = useNavigate()
  const setVideo = useAppStore(s => s.setVideo)
  const setFrames = useAppStore(s => s.setFrames)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const setSkill = useAppStore(s => s.setSkill)
  const reset = useAppStore(s => s.reset)

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  const [skills, setSkills] = useState([])
  const [loadingSkills, setLoadingSkills] = useState(true)

  const [videoArchives, setVideoArchives] = useState([])
  const [frameArchives, setFrameArchives] = useState([])
  const [archiveTab, setArchiveTab] = useState('videos')
  const [loadingArchives, setLoadingArchives] = useState(true)

  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  const inputRef = useRef()
  const importInputRef = useRef()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoadingSkills(true); setLoadingArchives(true)
    try {
      const [skillList, videos, frames] = await Promise.all([
        fetchSkillList(), fetchVideoArchives(), fetchFrameArchives()
      ])
      setSkills(skillList?.slice(0, 5) || [])
      setVideoArchives(videos || [])
      setFrameArchives(frames || [])
    } catch (e) { console.error('Failed to load data:', e) }
    finally { setLoadingSkills(false); setLoadingArchives(false) }
  }

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('video/')) {
      setError('请上传视频文件（MP4、MOV 等）')
      return
    }
    setError(null); setUploading(true); setProgress(0); reset()
    try {
      const res = await uploadVideo(file, setProgress)
      setVideo(res.videoId, res.filename, res.duration)
      navigate(`/playground/${res.videoId}`)
    } catch (e) { setError(e.message); setUploading(false) }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleImportSkill = async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('请选择 Skill 导出的 ZIP 文件'); return
    }
    setError(null); setImporting(true); setImportProgress(0)
    try {
      const imported = await importSkill(file, setImportProgress)
      setSkill(imported.skillId, imported.skillName, imported.files, imported.variables || [])
      setActiveTab('skill')
      navigate(`/playground/${imported.skillId}`)
    } catch (e) { setError('导入失败：' + e.message) }
    finally { setImporting(false); setImportProgress(0) }
  }

  const handleUseSkill = () => {
    reset(); navigate(`/playground/history`); setActiveTab('skill')
  }

  const handleUseVideoArchive = async (video) => {
    reset()
    setVideo(video.id, video.filename, video.duration || 0)
    try {
      const frames = await fetchFramesByVideo(video.id)
      if (frames && frames.length > 0) {
        setFrames(frames.map(f => ({
          frameId: f.frameId, timestamp: f.timestamp,
          base64Image: f.base64Preview || f.base64Image,
          description: f.description, annotationJson: f.annotationJson,
        })))
      }
    } catch (e) { console.error(e) }
    setActiveTab('annotate')
    navigate(`/playground/${video.id}`)
  }

  const handleUseFrameArchive = async (frame) => {
    reset()
    const formatted = {
      frameId: frame.frameId, timestamp: frame.timestamp,
      base64Image: frame.base64Preview || frame.base64Image,
      description: frame.description, annotationJson: frame.annotationJson,
    }
    setFrames([formatted])
    if (frame.videoArchiveId) {
      const related = videoArchives.find(v => v.id === frame.videoArchiveId)
      if (related) {
        setVideo(related.id, related.filename, related.duration || 0)
        setActiveTab('annotate'); navigate(`/playground/${related.id}`); return
      }
    }
    setActiveTab('skill'); navigate('/playground/frames')
  }

  return (
    <div className='min-h-screen'>
      {/* Subtle umber wash at top */}
      <div
        aria-hidden
        className='pointer-events-none fixed inset-x-0 top-0 h-[420px] opacity-40'
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(184, 138, 94, 0.18) 0%, rgba(184, 138, 94, 0.04) 45%, transparent 70%)',
        }}
      />

      <div className='relative max-w-[1180px] mx-auto px-8 lg:px-12 pt-14 pb-24'>
        {/* Masthead */}
        <header className='flex items-end justify-between pb-10 border-b hairline stagger'>
          <div>
            <div className='eyebrow mb-4 flex items-center gap-3'>
              <span>Easy</span>
              <span className='w-6 h-px bg-ink-200'></span>
              <span>Studio</span>
            </div>
            <h1 className='font-display text-[84px] leading-[0.92] text-ink-900 tracking-[-0.02em]'>
              视频，<span className='italic text-umber-500' style={{ fontVariationSettings: "'SOFT' 60, 'opsz' 144" }}>化作</span>
              <br/>可复用的 Skill
            </h1>
            <p className='mt-6 text-ink-500 text-[15px] max-w-[560px] leading-relaxed'>
              上传一段操作录屏，让 AI 读懂你的每一步操作，
              生成可直接运行、可再次调整的自动化脚本。
            </p>
          </div>

          <div className='hidden md:flex flex-col items-end gap-3 pb-2'>
            <div className='eyebrow'>Version · 1.0</div>
            <div className='font-mono text-xs text-ink-400'>{new Date().getFullYear()} · 工作室出品</div>
          </div>
        </header>

        {/* Primary grid */}
        <main className='mt-12 grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-10 stagger'>
          {/* Left column — Upload + Skill list */}
          <section className='space-y-8'>
            {/* Upload zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && inputRef.current?.click()}
              className={`relative card-paper overflow-hidden cursor-pointer group transition-all duration-500
                ${dragging ? 'ring-2 ring-umber-400/50 -translate-y-0.5' : 'hover:-translate-y-0.5 hover:shadow-lift'}`}
              style={{ padding: '56px 48px' }}
            >
              <input ref={inputRef} type='file' accept='video/*' className='hidden'
                onChange={(e) => handleFile(e.target.files[0])} />

              {/* Corner ornaments */}
              <Corners />

              {uploading ? (
                <div className='text-center py-6'>
                  <div className='inline-flex flex-col items-center gap-5'>
                    <RingProgress value={progress} />
                    <div>
                      <div className='font-display text-2xl text-ink-900 mb-1'>正在上传</div>
                      <div className='font-mono text-xs text-ink-400 tracking-wider'>{progress}%</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className='relative text-center'>
                  <div className='eyebrow mb-6'>Step · 01 Upload</div>
                  <div className='font-display text-[38px] leading-tight text-ink-900 mb-3' style={{ fontVariationSettings: "'opsz' 120" }}>
                    把视频交给我们
                  </div>
                  <p className='text-ink-500 text-sm max-w-sm mx-auto leading-relaxed mb-8'>
                    拖拽文件到此处，或点击选择。支持 MP4、MOV、AVI，最大 500MB。
                  </p>
                  <div className='inline-flex items-center gap-2 text-[13px] text-umber-600 font-medium
                                  transition-transform duration-500 group-hover:translate-x-1'>
                    <span>选择文件</span>
                    <ArrowIcon />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className='px-5 py-3.5 rounded-xl bg-clay-500/10 border border-clay-500/30 text-clay-700 text-sm'>
                {error}
              </div>
            )}

            {/* Skill List */}
            <div className='card-paper p-6'>
              <div className='flex items-end justify-between mb-5'>
                <div>
                  <div className='eyebrow mb-1.5'>Skill · 作品集</div>
                  <h3 className='font-display text-xl text-ink-900'>最近生成</h3>
                </div>
                <div className='flex items-center gap-1'>
                  <input
                    ref={importInputRef}
                    type='file'
                    accept='.zip,application/zip,application/x-zip-compressed'
                    className='hidden'
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; handleImportSkill(f) }}
                  />
                  <button
                    onClick={() => !importing && importInputRef.current?.click()}
                    disabled={importing}
                    className='btn-ghost disabled:opacity-60'
                    title='导入 Skill ZIP 包'
                  >
                    {importing ? (
                      <>
                        <span className='inline-block w-3 h-3 rounded-full border-2 border-umber-500/30 border-t-umber-500 animate-spin' />
                        <span className='font-mono text-[11px]'>{importProgress}%</span>
                      </>
                    ) : (
                      <>
                        <ImportIcon />
                        <span>导入 ZIP</span>
                      </>
                    )}
                  </button>
                  {skills.length > 0 && (
                    <button
                      onClick={() => { reset(); setActiveTab('skill'); navigate('/playground/history') }}
                      className='btn-ghost'
                    >
                      查看全部
                      <ArrowIcon small />
                    </button>
                  )}
                </div>
              </div>

              {loadingSkills ? (
                <SkillListSkeleton />
              ) : skills.length === 0 ? (
                <EmptyBlock hint='尚未生成任何 Skill' />
              ) : (
                <ul className='divide-y divide-ink-900/[0.06]'>
                  {skills.map((skill, idx) => (
                    <li
                      key={skill.skillId}
                      onClick={handleUseSkill}
                      className='group flex items-center gap-5 py-4 cursor-pointer transition-colors duration-300 hover:bg-paper-200/40 -mx-2 px-2 rounded-lg'
                    >
                      <div className='font-mono text-[11px] text-ink-400 tabular-nums w-6'>
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div className='flex-1 min-w-0'>
                        <div className='font-display text-[17px] text-ink-900 truncate leading-tight'>
                          {skill.skillName || '未命名'}
                        </div>
                        <div className='mt-1 font-mono text-[11px] text-ink-400 tracking-wide'>
                          {new Date(skill.createdAt).toLocaleDateString('zh-CN')}
                          {skill.platform && (<><span className='divider-dot'></span>{skill.platform}</>)}
                        </div>
                      </div>
                      <ArrowIcon tiny />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Right column — Archives */}
          <aside className='card-paper p-6 self-start'>
            <div className='flex items-end justify-between mb-5'>
              <div>
                <div className='eyebrow mb-1.5'>Archive · 素材库</div>
                <h3 className='font-display text-xl text-ink-900'>历史归档</h3>
              </div>
              <div className='inline-flex rounded-full bg-paper-200/60 p-1 text-[12px]'>
                <button
                  onClick={() => setArchiveTab('videos')}
                  className={`px-3 py-1.5 rounded-full transition-all duration-300
                    ${archiveTab === 'videos' ? 'bg-ink-900 text-paper-50 shadow-soft' : 'text-ink-500 hover:text-ink-900'}`}
                >视频 · {videoArchives.length}</button>
                <button
                  onClick={() => setArchiveTab('frames')}
                  className={`px-3 py-1.5 rounded-full transition-all duration-300
                    ${archiveTab === 'frames' ? 'bg-ink-900 text-paper-50 shadow-soft' : 'text-ink-500 hover:text-ink-900'}`}
                >帧 · {frameArchives.length}</button>
              </div>
            </div>

            <div className='min-h-[300px]'>
              {loadingArchives ? (
                <div className='py-12 text-center'>
                  <div className='inline-block w-4 h-4 rounded-full border-2 border-ink-200 border-t-umber-500 animate-spin'></div>
                </div>
              ) : archiveTab === 'videos' ? (
                videoArchives.length === 0 ? (
                  <EmptyBlock hint='尚未归档视频' />
                ) : (
                  <ul className='space-y-2.5 max-h-[380px] overflow-y-auto scrollbar-thin pr-1'>
                    {videoArchives.map(video => (
                      <li key={video.id}
                        onClick={() => handleUseVideoArchive(video)}
                        className='group flex items-center gap-4 p-3 rounded-xl border border-ink-900/[0.06] bg-paper-50 hover:bg-paper-200/50 hover:border-ink-900/[0.1] cursor-pointer transition-all duration-300'>
                        <div className='w-10 h-10 rounded-lg bg-gradient-to-br from-paper-200 to-paper-300 flex items-center justify-center text-ink-500 shadow-inset-hair shrink-0'>
                          <VideoGlyph />
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div className='text-[13.5px] text-ink-900 truncate'>{video.filename}</div>
                          <div className='mt-0.5 font-mono text-[10.5px] text-ink-400 tracking-wide'>
                            {video.frameCount > 0 ? `${video.frameCount} 帧` : '尚未抽帧'}
                            <span className='divider-dot'></span>
                            {formatSize(video.fileSize)}
                          </div>
                        </div>
                        <ArrowIcon tiny />
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                frameArchives.length === 0 ? (
                  <EmptyBlock hint='尚未归档帧' />
                ) : (
                  <div className='grid grid-cols-3 gap-2 max-h-[380px] overflow-y-auto scrollbar-thin pr-1'>
                    {frameArchives.map(frame => (
                      <div key={frame.id}
                        onClick={() => handleUseFrameArchive(frame)}
                        className='group relative aspect-video rounded-lg overflow-hidden cursor-pointer ring-1 ring-ink-900/[0.06] hover:ring-umber-500/40 hover:-translate-y-0.5 transition-all duration-300'>
                        {frame.base64Preview ? (
                          <img src={`data:image/jpeg;base64,${frame.base64Preview}`} alt='' className='w-full h-full object-cover' />
                        ) : (
                          <div className='w-full h-full bg-paper-200 flex items-center justify-center text-ink-400'>—</div>
                        )}
                        <div className='absolute inset-0 bg-ink-900/0 group-hover:bg-ink-900/55 transition-colors duration-300 flex items-center justify-center'>
                          <span className='text-[11px] text-paper-50 font-medium tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                            使用
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </aside>
        </main>

        {/* Footer */}
        <footer className='mt-20 pt-8 border-t hairline flex items-center justify-between text-[11px] text-ink-400 font-mono tracking-wider'>
          <span>EASY · SKILL · STUDIO</span>
          <span>Crafted with care — built for reuse</span>
        </footer>
      </div>
    </div>
  )
}

/* ---------- Atoms ---------- */

function Corners() {
  return (
    <>
      {['top-4 left-4', 'top-4 right-4', 'bottom-4 left-4', 'bottom-4 right-4'].map((pos, i) => (
        <span key={i} aria-hidden className={`absolute ${pos} w-3 h-3 opacity-30`}>
          <span className={`absolute ${i === 0 || i === 2 ? 'left-0' : 'right-0'} ${i < 2 ? 'top-0' : 'bottom-0'} w-full h-px bg-ink-900`} />
          <span className={`absolute ${i === 0 || i === 2 ? 'left-0' : 'right-0'} ${i < 2 ? 'top-0' : 'bottom-0'} h-full w-px bg-ink-900`} />
        </span>
      ))}
    </>
  )
}

function ArrowIcon({ small, tiny }) {
  const size = tiny ? 12 : small ? 13 : 15
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M5 12h14M13 5l7 7-7 7' />
    </svg>
  )
}

function ImportIcon() {
  return (
    <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' />
    </svg>
  )
}

function VideoGlyph() {
  return (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round' strokeLinejoin='round'>
      <rect x='3' y='6' width='13' height='12' rx='2' />
      <path d='M16 10l5-3v10l-5-3z' />
    </svg>
  )
}

function RingProgress({ value }) {
  const c = 2 * Math.PI * 26
  const offset = c - (c * value) / 100
  return (
    <svg width='72' height='72' viewBox='0 0 72 72'>
      <circle cx='36' cy='36' r='26' stroke='rgba(31,28,24,0.08)' strokeWidth='2' fill='none' />
      <circle cx='36' cy='36' r='26' stroke='var(--umber-500)' strokeWidth='2' fill='none'
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap='round'
        transform='rotate(-90 36 36)' style={{ transition: 'stroke-dashoffset 400ms ease' }} />
    </svg>
  )
}

function EmptyBlock({ hint }) {
  return (
    <div className='py-12 text-center'>
      <div className='mx-auto w-12 h-12 rounded-full border hairline-strong flex items-center justify-center text-ink-400 mb-4'>
        <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round' strokeLinejoin='round'>
          <circle cx='12' cy='12' r='9' /><path d='M9 12h6' />
        </svg>
      </div>
      <div className='text-[13px] text-ink-400'>{hint}</div>
    </div>
  )
}

function SkillListSkeleton() {
  return (
    <ul className='divide-y divide-ink-900/[0.06]'>
      {[0, 1, 2].map(i => (
        <li key={i} className='py-4 flex items-center gap-5'>
          <div className='w-6 h-3 rounded bg-paper-200' />
          <div className='flex-1 space-y-2'>
            <div className='h-3.5 w-1/2 rounded bg-paper-200' />
            <div className='h-2.5 w-1/4 rounded bg-paper-200' />
          </div>
        </li>
      ))}
    </ul>
  )
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let s = bytes, i = 0
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++ }
  return `${s.toFixed(1)} ${u[i]}`
}
