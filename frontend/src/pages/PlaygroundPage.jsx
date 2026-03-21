import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useAppStore from '../store/useAppStore.js'
import VideoPlayer from '../components/VideoPlayer.jsx'
import FrameTimeline from '../components/FrameTimeline.jsx'
import FrameAnnotator from '../components/FrameAnnotator.jsx'
import FrameList from '../components/FrameList.jsx'
import RequirementInput from '../components/RequirementInput.jsx'
import AIProcessor from '../components/AIProcessor.jsx'
import SkillEditor from '../components/SkillEditor.jsx'
import SkillExport from '../components/SkillExport.jsx'
import SkillList from '../components/SkillList.jsx'
import { extractFramesAuto, extractFramesManual } from '../api/client.js'

export default function PlaygroundPage() {
  const { videoId } = useParams()
  const navigate = useNavigate()

  const storeVideoId = useAppStore(s => s.videoId)
  const videoDuration = useAppStore(s => s.videoDuration)
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const addFrames = useAppStore(s => s.addFrames)
  const skillId = useAppStore(s => s.skillId)

  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState(null)
  const [interval, setInterval] = useState(3)

  useEffect(() => {
    // If no video in store (e.g. page refresh), go home
    if (!storeVideoId) {
      navigate('/')
    }
  }, [storeVideoId])

  const handleAutoExtract = async () => {
    setExtracting(true)
    setExtractError(null)
    try {
      const frames = await extractFramesAuto(videoId, interval)
      addFrames(frames)
    } catch (e) {
      setExtractError(e.message)
    } finally {
      setExtracting(false)
    }
  }

  const handleManualCapture = async (timestamp) => {
    setExtracting(true)
    setExtractError(null)
    try {
      const frames = await extractFramesManual(videoId, [timestamp])
      addFrames(frames)
    } catch (e) {
      setExtractError(e.message)
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className='min-h-screen flex flex-col'>
      {/* Top bar */}
      <header className='flex items-center gap-4 px-6 py-3 bg-slate-900 border-b border-slate-800'>
        <button
          onClick={() => navigate('/')}
          className='text-slate-400 hover:text-white transition-colors text-sm'
        >
          ← 返回
        </button>
        <h1 className='text-white font-semibold'>Easy Skill</h1>

        {/* Tabs */}
        <div className='ml-auto flex gap-1 bg-slate-800 rounded-lg p-1'>
          {[
            { id: 'annotate', label: '标注帧' },
            { id: 'skill', label: 'Skill 编辑器', badge: !!skillId },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors relative
                ${activeTab === tab.id ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {tab.label}
              {tab.badge && (
                <span className='absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full' />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Main content */}
      <div className='flex-1 flex overflow-hidden'>
        {activeTab === 'annotate' ? (
          <div className='flex-1 flex gap-4 p-4 overflow-hidden'>
            {/* Left: Video + Timeline */}
            <div className='flex-1 flex flex-col gap-4 min-w-0'>
              <VideoPlayer
                videoId={videoId}
                duration={videoDuration}
                onTimeSelect={handleManualCapture}
              />

              {/* Extract controls */}
              <div className='flex items-center gap-3'>
                <button
                  onClick={handleAutoExtract}
                  disabled={extracting}
                  className='px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors'
                >
                  {extracting ? '抽帧中...' : '⚡ 自动抽帧'}
                </button>
                <span className='text-slate-400 text-sm'>每</span>
                <input
                  type='number'
                  min={1}
                  max={60}
                  value={interval}
                  onChange={e => setInterval(Math.max(1, Math.min(60, Number(e.target.value))))}
                  className='w-14 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm text-center outline-none focus:border-blue-500 transition-colors'
                />
                <span className='text-slate-400 text-sm'>秒取一帧</span>
                {extractError && (
                  <span className='text-red-400 text-sm'>{extractError}</span>
                )}
              </div>

              {/* Frame timeline */}
              <div className='bg-slate-800/50 rounded-xl p-3'>
                <h3 className='text-slate-400 text-xs uppercase tracking-wider mb-2'>帧时间轴</h3>
                <FrameTimeline />
              </div>

              {/* Annotator */}
              <div className='flex-1'>
                <h3 className='text-slate-400 text-xs uppercase tracking-wider mb-2'>画布标注</h3>
                <FrameAnnotator />
              </div>
            </div>

            {/* Right sidebar */}
            <div className='w-72 flex flex-col gap-4 overflow-y-auto scrollbar-thin'>
              {/* Frame list */}
              <div className='bg-slate-800/50 rounded-xl p-3'>
                <h3 className='text-slate-400 text-xs uppercase tracking-wider mb-2'>帧列表</h3>
                <FrameList />
              </div>

              {/* Requirement */}
              <div className='bg-slate-800/50 rounded-xl p-3'>
                <RequirementInput />
              </div>

              {/* Generate */}
              <div className='bg-slate-800/50 rounded-xl p-3'>
                <AIProcessor />
              </div>
            </div>
          </div>
        ) : (
          <div className='flex-1 flex gap-4 p-4 overflow-hidden'>
            {/* Left: skill editor or empty hint */}
            <div className='flex-1 flex flex-col gap-3 overflow-hidden'>
              {skillId ? (
                <>
                  <SkillExport />
                  <div className='flex-1 overflow-hidden'>
                    <SkillEditor />
                  </div>
                </>
              ) : (
                <div className='flex-1 flex items-center justify-center text-slate-500'>
                  <div className='text-center'>
                    <div className='text-5xl mb-4'>⚡</div>
                    <p>请先在「标注帧」页生成 Skill，或从历史记录中加载</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar: history */}
            <div className='w-64 flex flex-col gap-2 overflow-y-auto scrollbar-thin'>
              <div className='bg-slate-800/50 rounded-xl p-3'>
                <h3 className='text-slate-400 text-xs uppercase tracking-wider mb-2'>历史 Skill</h3>
                <SkillList />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
