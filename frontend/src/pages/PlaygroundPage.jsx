import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useAppStore from '../store/useAppStore.js'
import VideoPlayer from '../components/VideoPlayer.jsx'
import FrameTimeline from '../components/FrameTimeline.jsx'
import FrameAnnotator from '../components/FrameAnnotator.jsx'
import FrameList from '../components/FrameList.jsx'
import RequirementHistorySelector from '../components/RequirementHistorySelector.jsx'
import AIProcessor from '../components/AIProcessor.jsx'
import SkillEditor from '../components/SkillEditor.jsx'
import SkillExport from '../components/SkillExport.jsx'
import SkillList from '../components/SkillList.jsx'
import SkillRunner from '../components/SkillRunner.jsx'
import ArchiveBrowser from '../components/ArchiveBrowser.jsx'
import SaveResourceButton from '../components/SaveResourceButton.jsx'
import { extractFramesAuto, extractFramesManual, uploadVideo } from '../api/client.js'

export default function PlaygroundPage() {
  const { videoId } = useParams()
  const navigate = useNavigate()

  const storeVideoId = useAppStore(s => s.videoId)
  const videoDuration = useAppStore(s => s.videoDuration)
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const addFrames = useAppStore(s => s.addFrames)
  const skillId = useAppStore(s => s.skillId)
  const setVideo = useAppStore(s => s.setVideo)
  const reset = useAppStore(s => s.reset)

  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState(null)
  const [interval, setInterval] = useState(3)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const fileInputRef = useRef()

  useEffect(() => {
    if (videoId === 'history' || videoId === 'frames') setActiveTab('skill')
  }, [videoId, setActiveTab])

  const handleAutoExtract = async () => {
    setExtracting(true); setExtractError(null)
    try {
      const frames = await extractFramesAuto(videoId, interval)
      addFrames(frames)
    } catch (e) { setExtractError(e.message) }
    finally { setExtracting(false) }
  }

  const handleManualCapture = async (timestamp) => {
    setExtracting(true); setExtractError(null)
    try {
      const frames = await extractFramesManual(videoId, [timestamp])
      addFrames(frames)
    } catch (e) { setExtractError(e.message) }
    finally { setExtracting(false) }
  }

  const handleReupload = async (file) => {
    if (!file || !file.type.startsWith('video/')) { alert('请上传视频文件'); return }
    setUploading(true); setUploadProgress(0); reset()
    try {
      const res = await uploadVideo(file, setUploadProgress)
      setVideo(res.videoId, res.filename, res.duration)
      setActiveTab('annotate')
      navigate(`/playground/${res.videoId}`)
    } catch (e) { alert('上传失败: ' + e.message) }
    finally { setUploading(false) }
  }

  return (
    <div className='min-h-screen flex flex-col'>
      {/* Top bar */}
      <header className='sticky top-0 z-20 bg-paper-100/85 backdrop-blur-md border-b hairline'>
        <div className='max-w-[1440px] mx-auto px-8 py-4 flex items-center gap-6'>
          <button
            onClick={() => navigate('/')}
            className='group flex items-center gap-2 text-ink-500 hover:text-ink-900 transition-colors text-sm'
          >
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' className='transition-transform duration-300 group-hover:-translate-x-0.5'>
              <path d='M19 12H5M12 19l-7-7 7-7' />
            </svg>
            <span>返回</span>
          </button>

          <div className='w-px h-5 bg-ink-900/10'></div>

          <div className='flex items-baseline gap-2'>
            <span className='font-display text-xl text-ink-900' style={{ fontVariationSettings: "'opsz' 120" }}>
              Easy <span className='italic text-umber-500'>Skill</span>
            </span>
            <span className='eyebrow'>Studio</span>
          </div>

          <div className='ml-6 flex items-center gap-2'>
            <input
              ref={fileInputRef} type='file' accept='video/*' className='hidden'
              onChange={(e) => handleReupload(e.target.files[0])}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className='btn-ghost disabled:opacity-60'
            >
              {uploading ? (
                <>
                  <span className='w-3 h-3 rounded-full border-2 border-umber-500/30 border-t-umber-500 animate-spin' />
                  <span className='font-mono text-[11px]'>{uploadProgress}%</span>
                </>
              ) : (
                <>
                  <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round'>
                    <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12' />
                  </svg>
                  <span>重新上传</span>
                </>
              )}
            </button>

            <SaveResourceButton />
          </div>

          {/* Tabs */}
          <div className='ml-auto inline-flex rounded-full bg-paper-200/70 p-1 text-[13px]'>
            {[
              { id: 'annotate', label: '标注帧', disabled: videoId === 'history' },
              { id: 'skill', label: 'Skill 编辑器', badge: !!skillId },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`relative px-4 py-1.5 rounded-full transition-all duration-300
                  ${activeTab === tab.id ? 'bg-ink-900 text-paper-50 shadow-soft' : 'text-ink-500 hover:text-ink-900'}
                  ${tab.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {tab.label}
                {tab.badge && (
                  <span className='absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-sage-500 ring-2 ring-paper-100' />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className='flex-1 flex overflow-hidden'>
        {activeTab === 'annotate' ? (
          !storeVideoId ? (
            <EmptyUploadHint onClick={() => fileInputRef.current?.click()} navigate={navigate}
              setVideo={setVideo} setActiveTab={setActiveTab} addFrames={addFrames} />
          ) : (
            <div className='flex-1 flex gap-5 px-6 py-5 overflow-hidden'>
              <div className='flex-1 flex flex-col gap-4 min-w-0'>
                <div className='card-paper p-3'>
                  <VideoPlayer videoId={videoId} duration={videoDuration} onTimeSelect={handleManualCapture} />
                </div>

                <div className='flex items-center gap-3 px-1'>
                  <button
                    onClick={handleAutoExtract}
                    disabled={extracting}
                    className='btn-primary disabled:opacity-60'
                  >
                    {extracting ? (
                      <>
                        <span className='w-3 h-3 rounded-full border-2 border-paper-50/30 border-t-paper-50 animate-spin' />
                        <span>抽帧中</span>
                      </>
                    ) : (
                      <>
                        <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
                          <path d='M13 2L4.09 12.97 12 13.5l-1 8.5 8.91-10.97L12 10.5l1-8.5z' />
                        </svg>
                        <span>自动抽帧</span>
                      </>
                    )}
                  </button>
                  <div className='flex items-center gap-2 text-ink-500 text-sm'>
                    <span>每</span>
                    <input
                      type='number' min={1} max={60} value={interval}
                      onChange={e => setInterval(Math.max(1, Math.min(60, Number(e.target.value))))}
                      className='w-14 bg-paper-50 border border-ink-900/10 rounded-lg px-2 py-1.5 text-ink-900 text-sm text-center outline-none focus:border-umber-500 transition-colors font-mono tabular-nums'
                    />
                    <span>秒取一帧</span>
                  </div>
                  {extractError && <span className='text-clay-500 text-sm'>{extractError}</span>}
                </div>

                <div className='card-paper p-4 min-w-0 overflow-hidden'>
                  <div className='eyebrow mb-3'>Timeline · 帧序</div>
                  <FrameTimeline />
                </div>

                <div className='flex-1 card-paper p-4 min-h-0 flex flex-col'>
                  <div className='eyebrow mb-3'>Canvas · 标注</div>
                  <div className='flex-1 min-h-0'>
                    <FrameAnnotator />
                  </div>
                </div>
              </div>

              <div className='w-80 flex flex-col gap-4 overflow-y-auto scrollbar-thin pr-1'>
                <div className='card-paper p-4'>
                  <div className='eyebrow mb-3'>Frames · 帧列表</div>
                  <FrameList />
                </div>
                <div className='card-paper p-4'>
                  <RequirementHistorySelector />
                </div>
                <div className='card-paper p-4'>
                  <AIProcessor />
                </div>
                <ArchiveBrowser />
              </div>
            </div>
          )
        ) : (
          <div className='flex-1 flex gap-5 px-6 py-5 overflow-hidden'>
            {/* Left sidebar · Skill 仓库（常驻） */}
            <div className='w-72 flex flex-col gap-4 overflow-y-auto scrollbar-thin'>
              <div className='card-paper p-4'>
                <div className='eyebrow mb-3'>Repository · Skill 仓库</div>
                <SkillList />
              </div>
            </div>

            {/* Center · 编辑器 */}
            <div className='flex-1 flex flex-col gap-4 min-h-0 min-w-0'>
              {skillId ? (
                <>
                  <div className='card-paper p-4'><SkillExport /></div>
                  <div className='flex-1 min-h-0 relative'>
                    <SkillEditor />
                  </div>
                </>
              ) : (
                <div className='flex-1 flex items-center justify-center'>
                  <div className='text-center max-w-sm'>
                    <div className='mx-auto w-14 h-14 rounded-full border hairline-strong flex items-center justify-center text-ink-400 mb-6'>
                      <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.3' strokeLinecap='round' strokeLinejoin='round'>
                        <path d='M13 2L4.09 12.97 12 13.5l-1 8.5 8.91-10.97L12 10.5l1-8.5z' />
                      </svg>
                    </div>
                    <div className='font-display text-2xl text-ink-900 mb-3' style={{ fontVariationSettings: "'opsz' 120" }}>
                      还没有 Skill
                    </div>
                    <p className='text-ink-500 text-sm leading-relaxed'>
                      请先在「标注帧」页生成 Skill，或从左侧 Skill 仓库选择已有的。
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar · Runner（仅在选中 Skill 时显示） */}
            {skillId && (
              <div className='w-[360px] flex flex-col gap-4 overflow-y-auto scrollbar-thin pr-1'>
                <div className='card-paper p-4'><SkillRunner /></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyUploadHint({ onClick, navigate, setVideo, setActiveTab, addFrames }) {
  return (
    <div className='flex-1 flex flex-col items-center justify-center px-8 py-16'>
      <div className='text-center max-w-lg'>
        <div className='eyebrow mb-5'>Step · 01 — Upload</div>
        <h2 className='font-display text-4xl text-ink-900 mb-4' style={{ fontVariationSettings: "'opsz' 120" }}>
          先上传一段<span className='italic text-umber-500'>视频</span>
        </h2>
        <p className='text-ink-500 text-sm leading-relaxed mb-10 max-w-sm mx-auto'>
          任何操作录屏都可以。AI 会分析画面与你的操作流程，生成可直接运行的自动化脚本。
        </p>

        <button
          onClick={onClick}
          className='group card-paper w-full py-10 px-8 cursor-pointer transition-all duration-500 hover:-translate-y-0.5 hover:shadow-lift text-left'
        >
          <div className='flex items-center gap-6'>
            <div className='w-14 h-14 rounded-full bg-gradient-to-br from-paper-200 to-paper-300 flex items-center justify-center shadow-inset-hair'>
              <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='var(--ink-700)' strokeWidth='1.4' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12' />
              </svg>
            </div>
            <div className='flex-1'>
              <div className='font-display text-xl text-ink-900'>点击选择文件</div>
              <div className='text-ink-500 text-sm mt-1'>支持 MP4、MOV、AVI 等格式</div>
            </div>
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'
              className='text-ink-400 transition-transform duration-500 group-hover:translate-x-1'>
              <path d='M5 12h14M13 5l7 7-7 7' />
            </svg>
          </div>
        </button>

        <div className='mt-10 pt-8 border-t hairline'>
          <div className='eyebrow mb-4'>Or · 使用已保存资源</div>
          <ArchiveBrowser
            onSelectVideo={(video, frames) => {
              const archiveVideoId = video.id || video.videoId
              setVideo(archiveVideoId, video.filename, video.duration || 0)
              if (frames && frames.length > 0) {
                useAppStore.setState({ frames: [] })
                const formatted = frames.map(f => ({
                  frameId: f.frameId, timestamp: f.timestamp,
                  base64Image: f.base64Preview || f.base64Image,
                  description: f.description, annotationJson: f.annotationJson,
                }))
                formatted.forEach(f => addFrames([f]))
              }
              setActiveTab('skill')
            }}
            onSelectFrames={(frames) => {
              if (frames && frames.length > 0) {
                useAppStore.setState({ frames: [] })
                const formatted = frames.map(f => ({
                  frameId: f.frameId, timestamp: f.timestamp,
                  base64Image: f.base64Preview || f.base64Image,
                  description: f.description, annotationJson: f.annotationJson,
                }))
                formatted.forEach(f => addFrames([f]))
                setActiveTab('skill')
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}
