import { useEffect, useState } from 'react'
import useAppStore from '../store/useAppStore.js'
import { fetchSkillList, getSkill, deleteSkill } from '../api/client.js'

const platformColors = {
  browser: 'bg-blue-500/20 text-blue-300',
  desktop: 'bg-purple-500/20 text-purple-300',
  mobile: 'bg-green-500/20 text-green-300',
}

function formatDate(iso) {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function SkillList() {
  const skillList = useAppStore(s => s.skillList)
  const setSkillList = useAppStore(s => s.setSkillList)
  const setSkill = useAppStore(s => s.setSkill)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const currentSkillId = useAppStore(s => s.skillId)

  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    loadSkillList()
  }, [])

  const loadSkillList = () => {
    fetchSkillList()
      .then(list => setSkillList(list))
      .catch(() => {})
  }

  const handleLoad = async (skillId) => {
    try {
      const skill = await getSkill(skillId)
      setSkill(skill.skillId, skill.skillName, skill.files)
      setActiveTab('skill')
    } catch (e) {
      console.error('Failed to load skill', e)
    }
  }

  const handleDelete = async (e, skillId, skillName) => {
    e.stopPropagation()
    
    if (!confirm(`确定要删除 Skill "${skillName}" 吗？\n此操作不可恢复。`)) {
      return
    }

    setDeletingId(skillId)
    try {
      await deleteSkill(skillId)
      // 如果删除的是当前正在编辑的 skill，清空当前 skill
      if (currentSkillId === skillId) {
        setSkill(null, null, [])
      }
      // 刷新列表
      loadSkillList()
    } catch (err) {
      alert('删除失败：' + err.message)
    } finally {
      setDeletingId(null)
    }
  }

  if (skillList.length === 0) {
    return (
      <p className='text-slate-500 text-sm text-center py-4'>暂无历史 Skill</p>
    )
  }

  return (
    <ul className='flex flex-col gap-2'>
      {skillList.map(item => (
        <li
          key={item.skillId}
          onClick={() => handleLoad(item.skillId)}
          className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors
            ${currentSkillId === item.skillId 
              ? 'bg-blue-600/30 border border-blue-500/50' 
              : 'bg-slate-700/50 hover:bg-slate-600/60 border border-transparent'}`}
        >
          <div className='flex-1 min-w-0'>
            <p className='text-white text-sm font-medium truncate'>{item.skillName}</p>
            <p className='text-slate-400 text-xs'>{formatDate(item.createdAt)}</p>
          </div>
          
          <div className='flex items-center gap-2 shrink-0'>
            {item.platform && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${platformColors[item.platform] ?? 'bg-slate-500/20 text-slate-300'}`}>
                {item.platform}
              </span>
            )}
            
            {/* Delete button */}
            <button
              onClick={(e) => handleDelete(e, item.skillId, item.skillName)}
              disabled={deletingId === item.skillId}
              className={`w-6 h-6 flex items-center justify-center rounded transition-all
                ${deletingId === item.skillId 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'opacity-0 group-hover:opacity-100 hover:bg-red-600/80 text-slate-400 hover:text-white'}`}
              title='删除'
            >
              {deletingId === item.skillId ? (
                <span className='w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin' />
              ) : (
                '×'
              )}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
