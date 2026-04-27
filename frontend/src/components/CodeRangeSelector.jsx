import { useRef, useEffect, useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'

export default function CodeRangeSelector({ code, selectedRange, onSelect }) {
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [decorations, setDecorations] = useState([])
  
  // 处理编辑器挂载
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    
    // 配置编辑器
    editor.updateOptions({
      readOnly: false,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      lineNumbers: 'on',
      glyphMargin: true,
      folding: true,
      renderLineHighlight: 'all',
      contextmenu: false,
      selectionHighlight: true,
      occurrencesHighlight: false,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, monospace',
      padding: { top: 8, bottom: 8 },
    })
    
    // 监听选择变化
    editor.onDidChangeCursorSelection((e) => {
      const { selection } = e
      const startLine = Math.min(selection.startLineNumber, selection.endLineNumber)
      const endLine = Math.max(selection.startLineNumber, selection.endLineNumber)
      
      if (startLine !== endLine || selection.startColumn !== selection.endColumn) {
        onSelect({ start: startLine, end: endLine })
        updateHighlight(startLine, endLine)
      }
    })
    
    // 监听点击行号
    editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
        const lineNumber = e.target.position.lineNumber
        handleLineNumberClick(lineNumber)
      }
    })
    
    // 初始高亮
    if (selectedRange) {
      updateHighlight(selectedRange.start, selectedRange.end)
    }
  }
  
  // 处理行号点击（快速选择单行或范围）
  const handleLineNumberClick = useCallback((lineNumber) => {
    if (!selectedRange) {
      // 第一次选择，选中单行
      onSelect({ start: lineNumber, end: lineNumber })
      updateHighlight(lineNumber, lineNumber)
    } else {
      // 按住 Shift 扩展选择，否则重新选择
      if (isSelecting) {
        const start = Math.min(selectedRange.start, lineNumber)
        const end = Math.max(selectedRange.end, lineNumber)
        onSelect({ start, end })
        updateHighlight(start, end)
      } else {
        onSelect({ start: lineNumber, end: lineNumber })
        updateHighlight(lineNumber, lineNumber)
      }
    }
  }, [selectedRange, isSelecting, onSelect])
  
  // 更新高亮装饰
  const updateHighlight = useCallback((startLine, endLine) => {
    if (!editorRef.current || !monacoRef.current) return
    
    const editor = editorRef.current
    const monaco = monacoRef.current
    
    // 清除旧的高亮
    if (decorations.length > 0) {
      editor.deltaDecorations(decorations, [])
    }
    
    // 添加新的高亮装饰
    const newDecorations = []
    
    for (let line = startLine; line <= endLine; line++) {
      newDecorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'selected-code-line',
          glyphMarginClassName: 'selected-line-indicator',
          overviewRuler: {
            color: 'rgba(59, 130, 246, 0.5)',
            position: monaco.editor.OverviewRulerLane.Full
          }
        }
      })
    }
    
    const applied = editor.deltaDecorations([], newDecorations)
    setDecorations(applied)
  }, [decorations])
  
  // 当外部 selectedRange 变化时更新高亮
  useEffect(() => {
    if (selectedRange && editorRef.current) {
      updateHighlight(selectedRange.start, selectedRange.end)
    } else if (!selectedRange && decorations.length > 0) {
      editorRef.current?.deltaDecorations(decorations, [])
      setDecorations([])
    }
  }, [selectedRange, updateHighlight])
  
  // 获取选中的代码内容
  const getSelectedCode = useCallback(() => {
    if (!selectedRange || !code) return ''
    const lines = code.split('\n')
    return lines.slice(selectedRange.start - 1, selectedRange.end).join('\n')
  }, [selectedRange, code])
  
  // 清除选择
  const clearSelection = useCallback(() => {
    onSelect(null)
    if (decorations.length > 0 && editorRef.current) {
      editorRef.current.deltaDecorations(decorations, [])
      setDecorations([])
    }
  }, [onSelect, decorations])
  
  // 选择全部代码
  const selectAll = useCallback(() => {
    if (!code) return
    const lines = code.split('\n')
    const range = { start: 1, end: lines.length }
    onSelect(range)
    updateHighlight(1, lines.length)
  }, [code, onSelect, updateHighlight])
  
  // 计算选中行数
  const selectedLineCount = selectedRange 
    ? selectedRange.end - selectedRange.start + 1 
    : 0
  
  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {selectedRange 
              ? `已选择 ${selectedLineCount} 行`
              : '拖动选择代码行，或点击行号'
            }
          </span>
          {selectedRange && (
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
              {getSelectedCode().length} 字符
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={selectAll}
            className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
          >
            全选
          </button>
          {selectedRange && (
            <button
              onClick={clearSelection}
              className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
            >
              清除
            </button>
          )}
        </div>
      </div>
      
      {/* Editor */}
      <div className="flex-1 relative">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={code}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            readOnly: true,
            domReadOnly: true,
          }}
          loading={
            <div className="h-full flex items-center justify-center text-slate-500">
              加载编辑器...
            </div>
          }
        />
        
        {/* 添加自定义样式 */}
        <style>{`
          .selected-code-line {
            background-color: rgba(59, 130, 246, 0.15) !important;
            border-left: 3px solid rgb(59, 130, 246);
          }
          .selected-line-indicator {
            background-color: rgb(59, 130, 246);
            width: 6px !important;
            height: 6px !important;
            border-radius: 50%;
            margin-left: 4px;
            margin-top: 8px;
          }
        `}</style>
      </div>
      
      {/* Quick Select Bar */}
      {code && (
        <div className="px-3 py-2 bg-slate-800/30 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>快速选择:</span>
            <div className="flex gap-1">
              {[
                { label: '导入区', pattern: /^import|^const.*require/ },
                { label: 'main函数', pattern: /async function main|function main/ },
                { label: '初始化', pattern: /agentFrom|new PuppeteerAgent|agent\.ai/ },
                { label: '数据提取', pattern: /aiQuery|return.*data/ },
              ].map(({ label, pattern }) => {
                const lines = code.split('\n')
                const matchLine = lines.findIndex(l => pattern.test(l)) + 1
                if (matchLine === 0) return null
                
                return (
                  <button
                    key={label}
                    onClick={() => {
                      onSelect({ start: matchLine, end: Math.min(matchLine + 4, lines.length) })
                      updateHighlight(matchLine, Math.min(matchLine + 4, lines.length))
                      // 滚动到该行
                      editorRef.current?.revealLineInCenter(matchLine)
                    }}
                    className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
