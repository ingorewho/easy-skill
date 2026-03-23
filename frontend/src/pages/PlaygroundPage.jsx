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

  // 处理从首页直接进入 skill 标签的情况
  useEffect(() => {
    if (videoId === 'history') {
      setActiveTab('skill')
    }
  }, [videoId, setActiveTab])

  // 不再强制跳转，允许空界面
  // useEffect(() => {
  //   if (!storeVideoId && videoId !== 'history') {
  //     navigate('/')
  //   }
  // }, [storeVideoId, videoId, navigate])

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

  const handleReupload = async (file) => {
    if (!file || !file.type.startsWith('video/')) {
      alert('请上传视频文件（MP4、MOV 等）')
      return
    }
    
    setUploading(true)
    setUploadProgress(0)
    reset()

    try {
      const res = await uploadVideo(file, setUploadProgress)
      setVideo(res.videoId, res.filename, res.duration)
      // 重置到标注页并导航到新视频
      setActiveTab('annotate')
      navigate(`/playground/${res.videoId}`)
    } catch (e) {
      alert('上传失败: ' + e.message)
    } finally {
      setUploading(false)
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

        {/* 重新上传按钮 */}
        <input
          ref={fileInputRef}
          type='file'
          accept='video/*'
          className='hidden'
          onChange={(e) => handleReupload(e.target.files[0])}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className='ml-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm rounded-lg transition-colors flex items-center gap-2'
        >
          {uploading ? (
            <>
              <span className='w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin' />
              <span>上传中 {uploadProgress}%</span>
            </>
          ) : (
            <>
              <span>📤</span>
              <span>重新上传</span>
            </>
          )}
        </button>

        {/* 保存资源按钮 */}
        <div className='ml-2'>
          <SaveResourceButton />
        </div>

        {/* Tabs */}
        <div className='ml-auto flex gap-1 bg-slate-800 rounded-lg p-1'>
          {[
            { id: 'annotate', label: '标注帧', disabled: videoId === 'history' },
            { id: 'skill', label: 'Skill 编辑器', badge: !!skillId },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors relative
                ${activeTab === tab.id ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}
                ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          !storeVideoId ? (
            // 空界面 - 提示上传视频
            <div className='flex-1 flex flex-col items-center justify-center p-8'>
              <div className='text-center max-w-md'>
                <div className='text-6xl mb-6'>🎬</div>
                <h2 className='text-2xl font-bold text-white mb-3'>开始创建 Skill</h2>
                <p className='text-slate-400 mb-8'>上传操作视频，AI 将自动生成可复用的自动化脚本</p>
                
                {/* 上传区域 */}
                <div
                  className='border-2 border-dashed border-slate-600 hover:border-blue-500 bg-slate-800/50 rounded-2xl p-12 text-center cursor-pointer transition-all'
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className='text-4xl mb-3'>📁</div>
                  <p className='text-slate-300 text-lg mb-2'>点击选择视频文件</p>
                  <p className='text-slate-500 text-sm'>支持 MP4、MOV、AVI 等格式</p>
                </div>

                {/* 或从归档选择 */}
                <div className='mt-8 w-full max-w-md'>
                  <p className='text-slate-500 text-sm mb-3'>或者使用已保存的资源</p>
                  <ArchiveBrowser 
                    onSelectVideo={(video, frames) => {
                      console.log('Selected video:', video, 'frames:', frames)
                      // 加载关联的帧（视频文件可能已清理，只加载帧）
                      if (frames && frames.length > 0) {
                        // 先清空现有帧
                        useAppStore.setState({ frames: [] })
                        // 添加归档的帧
                        const formattedFrames = frames.map(f => ({
                          frameId: f.frameId,
                          timestamp: f.timestamp,
                          base64Image: f.base64Preview || f.base64Image,
                          description: f.description,
                          annotationJson: f.annotationJson
                        }))
                        formattedFrames.forEach(f => addFrames([f]))
                        // 切换到 skill 标签
                        setActiveTab('skill')
                      } else {
                        alert('该视频没有保存关联的帧。提示：保存视频后需要再保存帧才能建立关联。')
                      }
                    }}
                    onSelectFrames={(frames) => {
                      // 直接加载帧（用于生成 Skill）
                      if (frames && frames.length > 0) {
                        // 先清空现有帧
                        useAppStore.setState({ frames: [] })
                        // 添加归档的帧
                        const formattedFrames = frames.map(f => ({
                          frameId: f.frameId,
                          timestamp: f.timestamp,
                          base64Image: f.base64Preview || f.base64Image,
                          description: f.description,
                          annotationJson: f.annotationJson
                        }))
                        formattedFrames.forEach(f => addFrames([f]))
                        setActiveTab('skill')
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
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

              {/* Right sidebar -- 有视频时显示 */}
              <div className='w-72 flex flex-col gap-4 overflow-y-auto scrollbar-thin'>
                {/* Frame list */}
                <div className='bg-slate-800/50 rounded-xl p-3'>
                  <h3 className='text-slate-400 text-xs uppercase tracking-wider mb-2'>帧列表</h3>
                  <FrameList />
                </div>

                {/* Requirement with History */}
                <div className='bg-slate-800/50 rounded-xl p-3'>
                  <RequirementHistorySelector />
                </div>

                {/* Generate */}
                <div className='bg-slate-800/50 rounded-xl p-3'>
                  <AIProcessor />
                </div>

                {/* Archive Browser */}
                <ArchiveBrowser />
              </div>
            </div>
          )  // 结束 !storeVideoId 三元运算符
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

            {/* Right sidebar: runner + history */}
            <div className='w-80 flex flex-col gap-3 overflow-y-auto scrollbar-thin'>
              {skillId && (
                <SkillRunner />
              )}
              <div className='bg-slate-800/50 rounded-xl p-3'>
                <h3 className='text-slate-400 text-xs uppercase tracking-wider mb-2'>Skill 仓库</h3>
                <SkillList />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
