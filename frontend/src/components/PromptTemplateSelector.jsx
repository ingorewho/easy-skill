import { useState, useEffect } from 'react'
import { fetchPromptTemplates, createPromptTemplate, deletePromptTemplate, incrementTemplateUseCount } from '../api/client.js'

export default function PromptTemplateSelector({ value, onChange, onSelect }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateCategory, setNewTemplateCategory] = useState('custom')

  // 加载模板列表
  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const data = await fetchPromptTemplates()
      setTemplates(data || [])
    } catch (e) {
      console.error('Failed to load templates:', e)
    } finally {
      setLoading(false)
    }
  }

  // 选择模板
  const handleSelectTemplate = async (template) => {
    // 追加到现有内容
    const newValue = value 
      ? value + '\n\n' + template.content 
      : template.content
    onChange(newValue)
    
    // 增加使用次数
    try {
      await incrementTemplateUseCount(template.id)
    } catch (e) {
      // 忽略错误
    }
    
    if (onSelect) onSelect(template)
  }

  // 保存为新模板
  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim() || !value.trim()) return
    
    try {
      await createPromptTemplate({
        name: newTemplateName,
        content: value,
        category: newTemplateCategory
      })
      setShowSaveDialog(false)
      setNewTemplateName('')
      loadTemplates() // 刷新列表
    } catch (e) {
      alert('保存失败: ' + e.message)
    }
  }

  // 删除模板
  const handleDeleteTemplate = async (id, e) => {
    e.stopPropagation()
    if (!confirm('确定要删除这个模板吗？')) return
    
    try {
      await deletePromptTemplate(id)
      loadTemplates()
    } catch (err) {
      alert('删除失败: ' + err.message)
    }
  }

  // 分类图标和颜色
  const getCategoryStyle = (category) => {
    switch (category) {
      case 'error-handling': return { icon: '🛡️', label: '错误处理', color: 'bg-red-900/50 text-red-400' }
      case 'logging': return { icon: '📝', label: '日志', color: 'bg-blue-900/50 text-blue-400' }
      case 'data-extraction': return { icon: '📊', label: '数据提取', color: 'bg-green-900/50 text-green-400' }
      default: return { icon: '✨', label: '自定义', color: 'bg-purple-900/50 text-purple-400' }
    }
  }

  return (
    <div className="space-y-3">
      {/* 快捷模板按钮 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">常用模板</span>
        <button
          onClick={() => setShowSaveDialog(true)}
          disabled={!value.trim()}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
        >
          💾 保存为模板
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-slate-500">加载中...</div>
      ) : templates.length === 0 ? (
        <div className="text-xs text-slate-600">暂无保存的模板</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {templates.slice(0, 6).map(template => {
            const style = getCategoryStyle(template.category)
            return (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className={`group relative px-2 py-1 rounded-md text-xs transition-all hover:opacity-80 ${style.color}`}
                title={template.content.substring(0, 100) + '...'}
              >
                <span className="mr-1">{style.icon}</span>
                {template.name}
                <span className="ml-1 opacity-50">({template.useCount || 0})</span>
                
                {/* 删除按钮 */}
                <span
                  onClick={(e) => handleDeleteTemplate(template.id, e)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[10px] 
                           flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* 保存模板对话框 */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-4 w-80">
            <h3 className="text-white text-sm font-medium mb-3">保存为模板</h3>
            
            <input
              type="text"
              placeholder="模板名称"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white mb-3"
            />
            
            <select
              value={newTemplateCategory}
              onChange={(e) => setNewTemplateCategory(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white mb-4"
            >
              <option value="custom">✨ 自定义</option>
              <option value="error-handling">🛡️ 错误处理</option>
              <option value="logging">📝 日志</option>
              <option value="data-extraction">📊 数据提取</option>
            </select>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!newTemplateName.trim()}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
