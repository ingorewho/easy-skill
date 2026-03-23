import { useState, useEffect } from 'react'
import useAppStore from '../store/useAppStore.js'
import { fetchRecentRequirements, saveRequirement, updateRequirementUseCount } from '../api/client.js'

export default function RequirementHistorySelector() {
  const requirement = useAppStore(s => s.requirement)
  const setRequirement = useAppStore(s => s.setRequirement)
  const frames = useAppStore(s => s.frames)
  const platform = useAppStore(s => s.skillFiles?.find(f => f.name === 'package.json')?.content?.includes('@midscene/android') ? 'android' : 'browser')

  const [history, setHistory] = useState([])
  const [showSelector, setShowSelector] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const data = await fetchRecentRequirements()
      setHistory(data || [])
    } catch (e) {
      console.error('Failed to load requirement history:', e)
    }
  }

  const handleSelect = async (item) => {
    setRequirement(item.content)
    await updateRequirementUseCount(item.id)
    setShowSelector(false)
    loadHistory() // 刷新使用次数
  }

  const handleSaveCurrent = async () => {
    if (!requirement.trim()) return
    setSaving(true)
    try {
      const frameIds = frames.map(f => f.frameId)
      await saveRequirement(requirement, frameIds, platform)
      await loadHistory()
      setShowSelector(false)
    } catch (e) {
      console.error('Failed to save requirement:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-slate-400 text-xs">用户诉求</label>
        <div className="flex gap-2">
          {requirement.trim() && (
            <button
              onClick={handleSaveCurrent}
              disabled={saving}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              {saving ? '保存中...' : '💾 保存'}
            </button>
          )}
          <button
            onClick={() => {
              loadHistory()
              setShowSelector(!showSelector)
            }}
            className="text-xs text-slate-400 hover:text-slate-300"
          >
            📜 历史 ({history.length})
          </button>
        </div>
      </div>

      <textarea
        value={requirement}
        onChange={e => setRequirement(e.target.value)}
        placeholder="描述你希望 AI 帮你完成的自动化任务..."
        className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 outline-none resize-none"
      />

      {showSelector && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg max-h-48 overflow-y-auto">
          {history.length === 0 ? (
            <div className="p-3 text-slate-500 text-xs text-center">暂无历史诉求</div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className="w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
              >
                <div className="text-slate-300 text-xs line-clamp-2">{item.content}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-500 text-[10px]">
                    {item.platform}
                  </span>
                  {item.useCount > 0 && (
                    <span className="text-slate-500 text-[10px]">
                      使用 {item.useCount} 次
                    </span>
                  )}
                  <span className="text-slate-600 text-[10px] ml-auto">
                    {new Date(item.lastUsedAt || item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
