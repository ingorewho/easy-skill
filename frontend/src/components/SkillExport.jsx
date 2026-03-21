import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { useState } from 'react'
import useAppStore from '../store/useAppStore.js'
import { deploySkill } from '../api/client.js'

export default function SkillExport() {
  const skillId = useAppStore(s => s.skillId)
  const skillName = useAppStore(s => s.skillName)
  const skillFiles = useAppStore(s => s.skillFiles)

  const [deploying, setDeploying] = useState(false)
  const [deployStatus, setDeployStatus] = useState(null) // 'success' | 'error'
  const [deployMessage, setDeployMessage] = useState('')

  const handleFrontendZip = async () => {
    if (!skillFiles.length) return

    const zip = new JSZip()
    const folder = zip.folder(skillName || 'skill')

    for (const file of skillFiles) {
      folder.file(file.path, file.content)
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    saveAs(blob, `${skillName || 'skill'}.zip`)
  }

  const handleDeploy = async () => {
    if (!skillId) return
    setDeploying(true)
    setDeployStatus(null)
    setDeployMessage('')

    try {
      const result = await deploySkill(skillId)
      setDeployStatus('success')
      setDeployMessage(result.message || '部署成功')
    } catch (e) {
      setDeployStatus('error')
      setDeployMessage(e.message || '部署失败')
    } finally {
      setDeploying(false)
    }
  }

  return (
    <div className='flex items-center gap-3 px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700'>
      <div className='flex-1'>
        <span className='text-slate-300 text-sm font-medium'>{skillName || 'Untitled Skill'}</span>
        <span className='ml-2 text-slate-500 text-xs'>{skillFiles.length} 个文件</span>
      </div>

      <button
        onClick={handleFrontendZip}
        className='px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors'
      >
        📦 下载 ZIP
      </button>

      <button
        onClick={handleDeploy}
        disabled={deploying}
        className={`px-3 py-1.5 text-white text-sm rounded-lg transition-colors flex items-center gap-2
          ${deploying ? 'bg-green-700 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}
      >
        {deploying ? (
          <>
            <span className='w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin' />
            部署中...
          </>
        ) : (
          <>
            🚀 一键部署到本地
          </>
        )}
      </button>

      {deployStatus && (
        <span className={`text-xs ${deployStatus === 'success' ? 'text-green-400' : 'text-red-400'}`}>
          {deployMessage}
        </span>
      )}
    </div>
  )
}
