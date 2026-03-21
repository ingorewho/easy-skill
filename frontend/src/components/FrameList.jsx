import { useState, useRef } from 'react'
import useAppStore from '../store/useAppStore.js'

export default function FrameList() {
  const frames = useAppStore(s => s.frames)
  const selectedFrameId = useAppStore(s => s.selectedFrameId)
  const setSelectedFrameId = useAppStore(s => s.setSelectedFrameId)
  const updateFrameDescription = useAppStore(s => s.updateFrameDescription)
  const removeFrame = useAppStore(s => s.removeFrame)
  const moveFrame = useAppStore(s => s.moveFrame)
  const reorderFrames = useAppStore(s => s.reorderFrames)

  const [deletingId, setDeletingId] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const dragItemRef = useRef(null)

  const fmt = (s) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleDelete = (e, frameId, index) => {
    e.stopPropagation()
    
    if (!confirm(`确定要删除第 ${index + 1} 帧吗？`)) {
      return
    }

    setDeletingId(frameId)
    removeFrame(frameId)
    setDeletingId(null)
  }

  const handleMove = (e, frameId, direction) => {
    e.stopPropagation()
    moveFrame(frameId, direction)
  }

  // Drag and Drop handlers
  const handleDragStart = (e, index) => {
    dragItemRef.current = index
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index)
    setTimeout(() => {
      e.target.classList.add('opacity-50')
    }, 0)
  }

  const handleDragEnd = (e) => {
    e.target.classList.remove('opacity-50')
    dragItemRef.current = null
    setDragOverIndex(null)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'))
    
    if (dragIndex === dropIndex || isNaN(dragIndex)) {
      setDragOverIndex(null)
      return
    }

    // Reorder frames
    const newFrames = [...frames]
    const [removed] = newFrames.splice(dragIndex, 1)
    newFrames.splice(dropIndex, 0, removed)
    reorderFrames(newFrames)
    
    setDragOverIndex(null)
  }

  if (frames.length === 0) {
    return (
      <div className='text-center py-8 text-slate-500 text-sm'>
        暂无帧
      </div>
    )
  }

  return (
    <div className='space-y-2 overflow-y-auto max-h-96 scrollbar-thin pr-1'>
      {frames.map((frame, index) => (
        <div
          key={frame.frameId}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          className={`group flex gap-3 p-2 rounded-lg cursor-move border transition-all
            ${selectedFrameId === frame.frameId
              ? 'border-blue-500 bg-blue-900/20'
              : 'border-transparent bg-slate-800/50 hover:bg-slate-800'}
            ${dragOverIndex === index ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-slate-900' : ''}
            ${dragItemRef.current === index ? 'opacity-50' : ''}`}
          onClick={() => setSelectedFrameId(frame.frameId)}
          title={`第 ${index + 1} 帧 - 拖拽可调整顺序`}
        >
          {/* 序号和移动按钮 */}
          <div className='flex flex-col items-center justify-center gap-1'>
            <span className='text-slate-500 text-xs font-mono w-5 text-center'>{index + 1}</span>
            
            {/* 上移按钮 */}
            {index > 0 && (
              <button
                className='w-5 h-5 flex items-center justify-center text-slate-600 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors'
                onClick={(e) => handleMove(e, frame.frameId, 'left')}
                title='上移'
              >
                ↑
              </button>
            )}
            
            {/* 下移按钮 */}
            {index < frames.length - 1 && (
              <button
                className='w-5 h-5 flex items-center justify-center text-slate-600 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors'
                onClick={(e) => handleMove(e, frame.frameId, 'right')}
                title='下移'
              >
                ↓
              </button>
            )}
          </div>

          {/* Thumbnail */}
          <img
            src={`data:image/jpeg;base64,${frame.base64Image}`}
            alt={`Frame ${index + 1}`}
            className='w-16 h-10 object-cover rounded flex-shrink-0 pointer-events-none'
            draggable={false}
          />

          {/* Info */}
          <div className='flex-1 min-w-0'>
            <div className='flex items-center justify-between mb-1'>
              <span className='text-slate-400 text-xs font-mono'>{fmt(frame.timestamp)}</span>
              <button
                onClick={(e) => handleDelete(e, frame.frameId, index)}
                disabled={deletingId === frame.frameId}
                className={`text-slate-600 hover:text-red-400 text-xs px-1 rounded transition-colors
                  ${deletingId === frame.frameId ? 'opacity-50' : ''}`}
              >
                {deletingId === frame.frameId ? '删除中...' : '删除'}
              </button>
            </div>
            <input
              type='text'
              placeholder='添加描述（可选）...'
              value={frame.description || ''}
              onChange={(e) => updateFrameDescription(frame.frameId, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className='w-full bg-transparent text-slate-300 text-xs placeholder-slate-600 outline-none border-b border-transparent focus:border-slate-600 transition-colors'
            />
          </div>
        </div>
      ))}
    </div>
  )
}
