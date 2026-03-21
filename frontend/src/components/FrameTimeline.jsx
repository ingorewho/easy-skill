import { useState, useRef } from 'react'
import useAppStore from '../store/useAppStore.js'

export default function FrameTimeline() {
  const frames = useAppStore(s => s.frames)
  const selectedFrameId = useAppStore(s => s.selectedFrameId)
  const setSelectedFrameId = useAppStore(s => s.setSelectedFrameId)
  const removeFrame = useAppStore(s => s.removeFrame)
  const moveFrame = useAppStore(s => s.moveFrame)
  const reorderFrames = useAppStore(s => s.reorderFrames)

  const [deletingId, setDeletingId] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const dragItemRef = useRef(null)

  if (frames.length === 0) {
    return (
      <div className='text-center py-4 text-slate-500 text-sm'>
        暂无帧，请点击「自动抽帧」或「截取当前帧」
      </div>
    )
  }

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
    // Add a slight delay to show the drag image
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

  return (
    <div className='flex gap-2 overflow-x-auto pb-2 scrollbar-thin'>
      {frames.map((frame, index) => (
        <div
          key={frame.frameId}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          className={`group relative flex-shrink-0 cursor-move rounded-lg overflow-hidden border-2 transition-all
            ${selectedFrameId === frame.frameId ? 'border-blue-500 scale-105' : 'border-transparent hover:border-slate-500'}
            ${dragOverIndex === index ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-slate-900' : ''}
            ${dragItemRef.current === index ? 'opacity-50' : ''}`}
          onClick={() => setSelectedFrameId(frame.frameId)}
          title={`第 ${index + 1} 帧 - 拖拽可调整顺序`}
        >
          {/* 左移按钮 */}
          {index > 0 && (
            <button
              className='absolute left-0.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-slate-800/80 hover:bg-blue-600/80 rounded text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10'
              onClick={(e) => handleMove(e, frame.frameId, 'left')}
              title='左移'
            >
              ←
            </button>
          )}

          {/* 右移按钮 */}
          {index < frames.length - 1 && (
            <button
              className='absolute right-0.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-slate-800/80 hover:bg-blue-600/80 rounded text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10'
              onClick={(e) => handleMove(e, frame.frameId, 'right')}
              title='右移'
            >
              →
            </button>
          )}

          <img
            src={`data:image/jpeg;base64,${frame.base64Image}`}
            alt={`Frame at ${fmt(frame.timestamp)}`}
            className='w-24 h-14 object-cover pointer-events-none'
            draggable={false}
          />
          
          {/* 序号 */}
          <div className='absolute top-0.5 left-0.5 bg-black/60 text-white text-[10px] px-1 rounded'>
            {index + 1}
          </div>

          <div className='absolute bottom-0 left-0 right-0 bg-black/70 text-xs text-white text-center py-0.5'>
            {fmt(frame.timestamp)}
          </div>

          {/* 删除按钮 */}
          <button
            className={`absolute top-0.5 right-0.5 w-5 h-5 bg-red-600/80 hover:bg-red-500 rounded text-white text-xs flex items-center justify-center transition-opacity z-10
              ${deletingId === frame.frameId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            onClick={(e) => handleDelete(e, frame.frameId, index)}
            disabled={deletingId === frame.frameId}
            title='删除'
          >
            {deletingId === frame.frameId ? (
              <span className='w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin' />
            ) : (
              '×'
            )}
          </button>

          {/* 有描述标记 */}
          {frame.description && (
            <div className='absolute bottom-5 left-0.5 w-2 h-2 bg-green-500 rounded-full' title='已添加描述' />
          )}
        </div>
      ))}
    </div>
  )
}
