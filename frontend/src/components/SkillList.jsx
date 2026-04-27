import { useEffect, useRef, useState } from 'react'
import useAppStore from '../store/useAppStore.js'
import { fetchSkillList, getSkill, deleteSkill, reorderSkills } from '../api/client.js'
import { GripVertical } from 'lucide-react'

const platformStyle = {
  browser:  'bg-paper-200/70 text-ink-700 border-ink-900/10',
  android:  'bg-sage-300/25 text-sage-700 border-sage-500/25',
  ios:      'bg-umber-50 text-umber-600 border-umber-300/50',
  computer: 'bg-clay-300/25 text-clay-700 border-clay-500/25',
}

function formatDate(iso) {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} · ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function SkillList() {
  const skillList = useAppStore(s => s.skillList)
  const setSkillList = useAppStore(s => s.setSkillList)
  const setSkill = useAppStore(s => s.setSkill)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const currentSkillId = useAppStore(s => s.skillId)

  const [deletingId, setDeletingId] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const [orderError, setOrderError] = useState('')
  const dragIndexRef = useRef(null)

  useEffect(() => { loadSkillList() }, [])

  const loadSkillList = () => {
    fetchSkillList().then(setSkillList).catch(() => {})
  }

  const handleLoad = async (skillId) => {
    try {
      const skill = await getSkill(skillId)
      setSkill(skill.skillId, skill.skillName, skill.files, skill.variables)
      setActiveTab('skill')
    } catch (e) { console.error('Failed to load skill', e) }
  }

  const handleDelete = async (e, skillId, skillName) => {
    e.stopPropagation()
    if (!confirm(`确定要删除 Skill "${skillName}" 吗？\n此操作不可恢复。`)) return
    setDeletingId(skillId)
    try {
      await deleteSkill(skillId)
      if (currentSkillId === skillId) setSkill(null, null, [], [])
      loadSkillList()
    } catch (err) { alert('删除失败：' + err.message) }
    finally { setDeletingId(null) }
  }

  const persistOrder = async (nextList, previousList) => {
    setSavingOrder(true)
    setOrderError('')
    try {
      await reorderSkills(nextList.map(skill => skill.skillId))
    } catch (err) {
      setSkillList(previousList)
      setOrderError('排序保存失败')
      setTimeout(() => setOrderError(''), 1800)
    } finally {
      setSavingOrder(false)
    }
  }

  const handleDragStart = (e, index) => {
    dragIndexRef.current = index
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const handleDragEnd = () => {
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    e.stopPropagation()

    const dragIndex = Number(e.dataTransfer.getData('text/plain'))
    if (!Number.isInteger(dragIndex) || dragIndex === dropIndex) {
      setDragOverIndex(null)
      return
    }

    const previousList = [...skillList]
    const nextList = [...skillList]
    const [moved] = nextList.splice(dragIndex, 1)
    nextList.splice(dropIndex, 0, moved)

    setSkillList(nextList)
    setDragOverIndex(null)
    persistOrder(nextList, previousList)
  }

  if (skillList.length === 0) {
    return <p className='text-ink-400 text-sm text-center py-4'>暂无历史 Skill</p>
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between px-1'>
        <span className='text-[11px] text-ink-400'>拖拽左侧手柄调整顺序</span>
        {savingOrder && <span className='text-[11px] text-umber-600'>保存中...</span>}
        {orderError && <span className='text-[11px] text-clay-500'>{orderError}</span>}
      </div>

      <ul className='divide-y divide-ink-900/[0.06]'>
        {skillList.map((item, idx) => {
          const active = currentSkillId === item.skillId
          const dragging = dragIndexRef.current === idx
          return (
            <li
              key={item.skillId}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => handleDrop(e, idx)}
              onClick={() => handleLoad(item.skillId)}
              className={`group flex items-start gap-2.5 py-2.5 -mx-1 px-2 rounded-lg cursor-pointer transition-all duration-200
                ${active ? 'bg-umber-50' : 'hover:bg-paper-200/40'}
                ${dragOverIndex === idx ? 'ring-1 ring-umber-400 bg-umber-50/70' : ''}
                ${dragging ? 'opacity-50' : ''}`}
            >
              <div
                className='mt-0.5 flex h-7 w-5 shrink-0 items-center justify-center rounded text-ink-300 hover:bg-paper-200 hover:text-ink-700 cursor-grab active:cursor-grabbing'
                title='拖拽调整顺序'
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className='h-3.5 w-3.5' />
              </div>

              <div className='font-mono text-[10.5px] text-ink-400 tabular-nums w-5 shrink-0 pt-1'>
                {String(idx + 1).padStart(2, '0')}
              </div>

              <div className='flex-1 min-w-0'>
                <div
                  title={item.skillName}
                  className={`font-display text-[14px] leading-snug break-words ${active ? 'text-umber-700' : 'text-ink-900'}`}
                >
                  {item.skillName}
                </div>
                <div className='mt-1.5 flex items-center flex-wrap gap-x-2 gap-y-1'>
                  {item.platform && (
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full border
                      ${platformStyle[item.platform] ?? 'bg-paper-200/70 text-ink-500 border-ink-900/10'}`}>
                      {item.platform}
                    </span>
                  )}
                  <span className='font-mono text-[10.5px] text-ink-400 tracking-wide'>
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => handleDelete(e, item.skillId, item.skillName)}
                disabled={deletingId === item.skillId}
                className={`w-6 h-6 flex items-center justify-center rounded-full shrink-0 mt-0.5 transition-all
                  ${deletingId === item.skillId
                    ? 'opacity-50 cursor-not-allowed'
                    : 'opacity-0 group-hover:opacity-100 hover:bg-clay-500/10 text-ink-400 hover:text-clay-500'}`}
                title='删除'
              >
                {deletingId === item.skillId ? (
                  <span className='w-3 h-3 rounded-full border-2 border-ink-200 border-t-umber-500 animate-spin' />
                ) : (
                  <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
                    <path d='M18 6L6 18M6 6l12 12' />
                  </svg>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
