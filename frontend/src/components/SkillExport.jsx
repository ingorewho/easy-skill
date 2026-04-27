import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { useState } from 'react'
import useAppStore from '../store/useAppStore.js'
import { deploySkill } from '../api/client.js'
import { Download, Rocket, Check, AlertCircle, Loader2 } from 'lucide-react'

export default function SkillExport() {
  const skillId = useAppStore(s => s.skillId)
  const skillName = useAppStore(s => s.skillName)
  const skillFiles = useAppStore(s => s.skillFiles)

  const [deploying, setDeploying] = useState(false)
  const [deployStatus, setDeployStatus] = useState(null)
  const [deployMessage, setDeployMessage] = useState('')

  const handleFrontendZip = async () => {
    if (!skillFiles.length) return
    const zip = new JSZip()
    const folder = zip.folder(skillName || 'skill')
    for (const file of skillFiles) folder.file(file.path, file.content)
    const blob = await zip.generateAsync({ type: 'blob' })
    saveAs(blob, `${skillName || 'skill'}.zip`)
  }

  const handleDeploy = async () => {
    if (!skillId) return
    setDeploying(true); setDeployStatus(null); setDeployMessage('')
    try {
      const result = await deploySkill(skillId)
      setDeployStatus('success'); setDeployMessage(result.message || '部署成功')
    } catch (e) {
      setDeployStatus('error'); setDeployMessage(e.message || '部署失败')
    } finally { setDeploying(false) }
  }

  return (
    <div className='flex items-center gap-3 px-4 py-2.5 card-paper bg-paper-50/70'>
      <div className='flex-1 flex items-baseline gap-2 min-w-0'>
        <span className='eyebrow'>Export</span>
        <span className='font-display text-[15px] text-ink-900 truncate'>
          {skillName || 'Untitled Skill'}
        </span>
        <span className='font-mono text-[10.5px] text-ink-400 tracking-wide shrink-0'>
          {skillFiles.length} · files
        </span>
      </div>

      <button
        onClick={handleFrontendZip}
        className='btn-ghost'
        title='下载 Skill ZIP'
      >
        <Download className='w-3.5 h-3.5' />
        <span>下载 ZIP</span>
      </button>

      <button
        onClick={handleDeploy}
        disabled={deploying}
        className='btn-primary disabled:opacity-60'
      >
        {deploying ? (
          <><Loader2 className='w-3.5 h-3.5 animate-spin' /><span>部署中</span></>
        ) : (
          <><Rocket className='w-3.5 h-3.5' /><span>一键部署</span></>
        )}
      </button>

      {deployStatus && (
        <span className={`inline-flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-full border
          ${deployStatus === 'success'
            ? 'bg-sage-300/20 border-sage-500/30 text-sage-700'
            : 'bg-clay-500/10 border-clay-500/25 text-clay-700'}`}>
          {deployStatus === 'success' ? <Check className='w-3 h-3' /> : <AlertCircle className='w-3 h-3' />}
          {deployMessage}
        </span>
      )}
    </div>
  )
}
