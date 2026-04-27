import { Check, ImageOff, Clock } from 'lucide-react'
import { useState } from 'react'

export default function FrameGridSelector({ frames, selectedIds, onToggle, maxSelection = 2, readOnly = false }) {
  const [previewFrame, setPreviewFrame] = useState(null)
  
  if (frames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-slate-500">
        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
          <ImageOff className="w-8 h-8 text-slate-600" />
        </div>
        <p className="text-sm font-medium text-slate-400 mb-1">暂无可用帧</p>
        <p className="text-xs text-center text-slate-600 leading-relaxed">
          当前没有可用的参考图片<br/>
          你可以：
        </p>
        <ul className="text-xs text-slate-600 mt-2 space-y-1 text-center">
          <li>• 不选图片，直接使用纯文本模式优化代码</li>
          <li>• 返回「标注帧」页面上传视频并抽帧</li>
        </ul>
      </div>
    )
  }
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  return (
    <div className="space-y-3">
      {/* Selection hint */}
      <div className="flex items-center justify-between text-xs">
        <span className={`${selectedIds.length >= maxSelection ? 'text-amber-400' : 'text-slate-500'}`}>
          {selectedIds.length >= maxSelection 
            ? `最多选择 ${maxSelection} 张` 
            : `可选择 ${maxSelection} 张图片作为参考`
          }
        </span>
        <span className="text-slate-600">{frames.length} 帧可用</span>
      </div>
      
      {/* Grid */}
      <div className={`grid gap-2 ${readOnly ? 'grid-cols-2' : 'grid-cols-2'}`}>
        {frames.map((frame, index) => {
          const isSelected = selectedIds.includes(frame.frameId)
          const isDisabled = !isSelected && selectedIds.length >= maxSelection && !readOnly
          
          return (
            <div
              key={frame.frameId}
              className={`
                relative aspect-video rounded-lg overflow-hidden
                border-2 transition-all group
                ${readOnly 
                  ? 'border-slate-800 cursor-default' 
                  : isSelected 
                    ? 'border-blue-500 ring-2 ring-blue-500/30 cursor-pointer' 
                    : isDisabled
                      ? 'border-slate-800 opacity-50 cursor-not-allowed'
                      : 'border-slate-700 hover:border-slate-500 hover:opacity-90 cursor-pointer'
                }
              `}
              onClick={() => !readOnly && !isDisabled && onToggle(frame.frameId)}
              onMouseEnter={() => setPreviewFrame(frame)}
              onMouseLeave={() => setPreviewFrame(null)}
            >
              {/* Image */}
              {frame.base64Image ? (
                <img
                  src={`data:image/jpeg;base64,${frame.base64Image}`}
                  alt={`Frame ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                  <ImageOff className="w-6 h-6 text-slate-600" />
                </div>
              )}
              
              {/* Overlay with timestamp */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-white/90 text-[10px]">
                  <Clock className="w-3 h-3" />
                  {formatTime(frame.timestamp)}
                </div>
              </div>
              
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              
              {/* Order indicator for multiple selection */}
              {isSelected && selectedIds.length > 1 && (
                <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-[10px] text-white font-medium shadow-lg">
                  {selectedIds.indexOf(frame.frameId) + 1}
                </div>
              )}
              
              {/* Hover overlay - 只在非只读模式下显示 */}
              {!readOnly && !isDisabled && !isSelected && (
                <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors flex items-center justify-center">
                  <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity font-medium drop-shadow-lg">
                    点击选择
                  </span>
                </div>
              )}
              
              {/* Disabled overlay */}
              {!readOnly && isDisabled && (
                <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                  <span className="text-slate-500 text-[10px]">已达上限</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {/* Preview panel (shows on hover) */}
      {!readOnly && previewFrame && previewFrame.description && (
        <div className="bg-slate-800/80 rounded-lg p-2 text-xs">
          <p className="text-slate-400 mb-1">帧描述：</p>
          <p className="text-slate-200 line-clamp-2">{previewFrame.description}</p>
        </div>
      )}
      
      {/* Selected frames summary - 只在非只读模式下显示 */}
      {!readOnly && selectedIds.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5">
          <p className="text-xs text-blue-400 font-medium mb-1">已选择 {selectedIds.length} 张图片</p>
          <p className="text-[10px] text-blue-300/70">
            {selectedIds.length === maxSelection 
              ? '已达到最大选择数量' 
              : `还可选择 ${maxSelection - selectedIds.length} 张`
            }
          </p>
        </div>
      )}
    </div>
  )
}
