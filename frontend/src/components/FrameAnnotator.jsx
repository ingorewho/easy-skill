import { useEffect, useRef, useState } from 'react'
import { fabric } from 'fabric'
import useAppStore from '../store/useAppStore.js'

const TOOLS = [
  { id: 'select', label: '选择' },
  { id: 'arrow', label: '箭头' },
  { id: 'rect', label: '矩形' },
  { id: 'text', label: '文字' },
]

export default function FrameAnnotator() {
  const canvasRef = useRef()
  const fabricRef = useRef(null)
  const [tool, setTool] = useState('select')

  // Use refs to avoid stale closures in event handlers
  const toolRef = useRef('select')
  const isDrawingRef = useRef(false)
  const startPointRef = useRef(null)
  const activeObjRef = useRef(null)
  const selectedFrameIdRef = useRef(null)
  const suppressSaveRef = useRef(false)

  const selectedFrameId = useAppStore(s => s.selectedFrameId)
  const frames = useAppStore(s => s.frames)
  const updateFrameAnnotation = useAppStore(s => s.updateFrameAnnotation)
  const updateFrameImage = useAppStore(s => s.updateFrameImage)
  const updateFrameAnnotationRef = useRef(updateFrameAnnotation)
  const updateFrameImageRef = useRef(updateFrameImage)
  updateFrameAnnotationRef.current = updateFrameAnnotation
  updateFrameImageRef.current = updateFrameImage

  const selectedFrame = frames.find(f => f.frameId === selectedFrameId)

  // Keep refs in sync
  const changeTool = (t) => {
    toolRef.current = t
    setTool(t)
  }

  useEffect(() => {
    selectedFrameIdRef.current = selectedFrameId
  }, [selectedFrameId])

  const saveAnnotation = () => {
    if (suppressSaveRef.current) return
    const canvas = fabricRef.current
    const frameId = selectedFrameIdRef.current
    if (!canvas || !frameId) return
    
    // Save annotation JSON
    const json = JSON.stringify(canvas.toJSON())
    updateFrameAnnotationRef.current(frameId, json)
    
    // Export annotated image and update thumbnail
    try {
      const dataUrl = canvas.toDataURL({
        format: 'jpeg',
        quality: 0.8,
        width: canvas.width,
        height: canvas.height
      })
      // Remove data URL prefix to get base64
      const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
      updateFrameImageRef.current(frameId, base64)
      console.log('[FrameAnnotator] Updated thumbnail with annotation')
    } catch (err) {
      console.error('[FrameAnnotator] Failed to export annotated image:', err)
    }
  }

  // Init fabric canvas once
  useEffect(() => {
    if (!canvasRef.current) return
    
    console.log('[FrameAnnotator] Initializing canvas')

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 640,
      height: 360,
      backgroundColor: '#1e293b',
    })
    fabricRef.current = canvas

    canvas.on('object:modified', saveAnnotation)

    // Enforce current tool mode on every newly added object.
    // This covers: loadFromJSON restores, arrow group assembly, rect creation —
    // any path that adds an object without going through the tool-change useEffect.
    canvas.on('object:added', ({ target }) => {
      if (!target) return
      const isSelect = toolRef.current === 'select'
      target.selectable = isSelect
      target.evented = isSelect
    })

    // Mouse event handlers using refs (no stale closure issue)
    canvas.on('mouse:down', (opt) => {
      if (toolRef.current === 'select') return
      const pointer = canvas.getPointer(opt.e)
      startPointRef.current = pointer
      isDrawingRef.current = true

      if (toolRef.current === 'text') {
        const text = new fabric.IText('文字', {
          left: pointer.x,
          top: pointer.y,
          fill: '#facc15',
          fontSize: 18,
          fontWeight: 'bold',
        })
        canvas.add(text)
        canvas.setActiveObject(text)
        text.enterEditing()
        toolRef.current = 'select'
        setTool('select')
        isDrawingRef.current = false
        return
      }

      if (toolRef.current === 'arrow') {
        // 用 line + triangle 组合实现带箭头的线，拖拽时先放预览线
        const line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: '#f87171',
          strokeWidth: 2.5,
          selectable: false,
          evented: false,
        })
        const head = new fabric.Triangle({
          width: 12, height: 14,
          fill: '#f87171',
          left: pointer.x, top: pointer.y,
          originX: 'center', originY: 'center',
          angle: 90,
          selectable: false,
          evented: false,
        })
        canvas.add(line, head)
        activeObjRef.current = { type: 'arrow', line, head }
      }

      if (toolRef.current === 'rect') {
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 1,
          height: 1,
          stroke: '#60a5fa',
          strokeWidth: 2,
          fill: 'transparent',
          selectable: true,
        })
        canvas.add(rect)
        activeObjRef.current = rect
      }
    })

    canvas.on('mouse:move', (opt) => {
      if (!isDrawingRef.current || !activeObjRef.current) return
      const pointer = canvas.getPointer(opt.e)
      const obj = activeObjRef.current

      if (obj.type === 'arrow') {
        const { line, head } = obj
        line.set({ x2: pointer.x, y2: pointer.y })
        // 计算箭头角度
        const angle = Math.atan2(pointer.y - line.y1, pointer.x - line.x1) * 180 / Math.PI
        head.set({ left: pointer.x, top: pointer.y, angle: angle + 90 })
      } else if (obj instanceof fabric.Rect) {
        const s = startPointRef.current
        obj.set({
          width: Math.abs(pointer.x - s.x),
          height: Math.abs(pointer.y - s.y),
          left: Math.min(pointer.x, s.x),
          top: Math.min(pointer.y, s.y),
        })
      }
      canvas.renderAll()
    })

    canvas.on('mouse:up', () => {
      if (!isDrawingRef.current) return
      isDrawingRef.current = false
      const obj = activeObjRef.current
      activeObjRef.current = null

      // 将预览的 line + head 合并为一个可选中的 Group
      if (obj && obj.type === 'arrow') {
        suppressSaveRef.current = true   // 屏蔽中间状态触发的 save
        const { line, head } = obj
        canvas.remove(line)
        canvas.remove(head)
        const group = new fabric.Group([line, head], { selectable: true })
        canvas.add(group)
        suppressSaveRef.current = false
      }
      saveAnnotation()
    })

    return () => canvas.dispose()
  }, [])

  // Load frame image when selection changes
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !selectedFrame || !selectedFrameId) {
      console.log('[FrameAnnotator] No canvas or selected frame:', { canvas: !!canvas, selectedFrame: !!selectedFrame, selectedFrameId })
      return
    }

    console.log('[FrameAnnotator] Loading frame:', selectedFrameId, 'has image:', !!selectedFrame.base64Image)

    suppressSaveRef.current = true
    canvas.clear()
    suppressSaveRef.current = false

    // Clear background first
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas))

    if (!selectedFrame.base64Image) {
      console.error('[FrameAnnotator] No base64 image data for frame:', selectedFrameId)
      return
    }

    const imageUrl = `data:image/jpeg;base64,${selectedFrame.base64Image}`
    
    fabric.Image.fromURL(
      imageUrl,
      (img) => {
        if (!img) {
          console.error('[FrameAnnotator] Failed to load image')
          return
        }
        
        img.set({ selectable: false, evented: false })
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
        img.set({
          scaleX: scale, scaleY: scale,
          originX: 'center', originY: 'center',
          left: canvas.width / 2, top: canvas.height / 2,
        })
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas))
        console.log('[FrameAnnotator] Image loaded successfully, scale:', scale)

        if (selectedFrame.annotationJson) {
          try {
            const data = JSON.parse(selectedFrame.annotationJson)
            canvas.loadFromJSON(data, () => {
              // Double-check: force current tool mode on all restored objects
              const isSelect = toolRef.current === 'select'
              canvas.forEachObject(obj => {
                obj.selectable = isSelect
                obj.evented = isSelect
              })
              canvas.renderAll()
            })
          } catch (err) {
            console.error('[FrameAnnotator] Failed to load annotations:', err)
          }
        }
      },
      { crossOrigin: 'anonymous' }
    )
  }, [selectedFrame, selectedFrameId])

  // Sync selection mode when tool changes
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const isSelect = tool === 'select'
    canvas.selection = isSelect
    // skipTargetFind=true: Fabric skips object hit-testing entirely in draw mode,
    // guaranteeing all mouse events reach canvas-level handlers regardless of
    // individual object evented/selectable state.
    canvas.skipTargetFind = !isSelect
    canvas.discardActiveObject()
    canvas.forEachObject(obj => {
      obj.selectable = isSelect
      obj.evented = isSelect
    })
    canvas.renderAll()
  }, [tool])

  const clearAnnotations = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const bg = canvas.backgroundImage
    suppressSaveRef.current = true
    canvas.clear()
    suppressSaveRef.current = false
    if (bg) canvas.setBackgroundImage(bg, canvas.renderAll.bind(canvas))
    saveAnnotation()
  }

  return (
    <div className='space-y-2'>
      {/* Toolbar */}
      <div className='flex items-center gap-2'>
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => changeTool(t.id)}
            disabled={!selectedFrame}
            className={`px-3 py-1 rounded-lg text-sm transition-colors
              ${tool === t.id ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}
              ${!selectedFrame ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={clearAnnotations}
          disabled={!selectedFrame}
          className={`ml-auto px-3 py-1 rounded-lg text-sm bg-slate-700 hover:bg-red-900 text-slate-300 transition-colors
            ${!selectedFrame ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          清除标注
        </button>
      </div>

      {/* Canvas - always rendered with placeholder overlay when no frame */}
      <div className='relative rounded-xl overflow-hidden border border-slate-700'>
        <canvas ref={canvasRef} />
        {!selectedFrame && (
          <div className='absolute inset-0 flex items-center justify-center bg-slate-800/80 text-slate-500'>
            请从时间轴选择一帧进行标注
          </div>
        )}
      </div>
    </div>
  )
}
