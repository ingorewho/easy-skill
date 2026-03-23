import { useState, useRef, useEffect, useCallback } from 'react'
import useAppStore from '../store/useAppStore.js'
import { fetchAndroidDevices, fetchIosDevices } from '../api/client.js'

export default function SkillRunner() {
  const skillId = useAppStore(s => s.skillId)
  const skillFiles = useAppStore(s => s.skillFiles)

  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState([])
  const [screenshots, setScreenshots] = useState([])
  const [result, setResult] = useState(null)
  
  // 运行配置
  const [targetUrl, setTargetUrl] = useState('')
  const [headless, setHeadless] = useState(false)
  const [platform, setPlatform] = useState('browser')
  const [deviceId, setDeviceId] = useState('')
  
  // 设备列表
  const [androidDevices, setAndroidDevices] = useState([])
  const [iosDevices, setIosDevices] = useState([])
  const [loadingDevices, setLoadingDevices] = useState(false)

  const wsRef = useRef(null)
  const logsEndRef = useRef(null)

  // 自动滚动到底部
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // 清理 WebSocket
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  // 从 skill 文件推断平台
  useEffect(() => {
    const packageJson = skillFiles.find(f => f.name === 'package.json')
    if (packageJson) {
      let detected = 'browser'
      if (packageJson.content.includes('@midscene/android')) {
        detected = 'android'
      } else if (packageJson.content.includes('@midscene/ios')) {
        detected = 'ios'
      } else if (packageJson.content.includes('@midscene/computer')) {
        detected = 'computer'
      }
      setPlatform(detected)
    }
  }, [skillFiles])

  // 加载设备列表
  useEffect(() => {
    if (platform === 'android') {
      loadAndroidDevices()
    } else if (platform === 'ios') {
      loadIosDevices()
    }
  }, [platform])

  const loadAndroidDevices = async () => {
    setLoadingDevices(true)
    try {
      const devices = await fetchAndroidDevices()
      setAndroidDevices(devices || [])
      if (devices && devices.length > 0 && !deviceId) {
        setDeviceId(devices[0].id)
      }
    } catch (e) {
      console.error('Failed to load android devices:', e)
      setAndroidDevices([])
    } finally {
      setLoadingDevices(false)
    }
  }

  const loadIosDevices = async () => {
    setLoadingDevices(true)
    try {
      const devices = await fetchIosDevices()
      setIosDevices(devices || [])
      if (devices && devices.length > 0 && !deviceId) {
        setDeviceId(devices[0].id)
      }
    } catch (e) {
      console.error('Failed to load iOS devices:', e)
      setIosDevices([])
    } finally {
      setLoadingDevices(false)
    }
  }

  const connectWebSocket = useCallback(() => {
    const wsUrl = `ws://${window.location.host}/ws/skill-run`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('[SkillRunner] WebSocket connected')
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('[SkillRunner] Received:', data)

      switch (data.type) {
        case 'connected':
          setLogs(prev => [...prev, { type: 'info', message: data.message }])
          break
        case 'started':
          setLogs(prev => [...prev, { type: 'info', message: data.message }])
          break
        case 'log':
          // 支持多种消息格式
          const logMessage = data.message || data.log || JSON.stringify(data)
          setLogs(prev => [...prev, { type: 'log', message: logMessage }])
          break
        case 'completed':
          setIsRunning(false)
          setResult(data)
          if (data.screenshots) {
            setScreenshots(data.screenshots)
          }
          setLogs(prev => [...prev, { 
            type: data.success ? 'success' : 'error', 
            message: `${data.message} (耗时: ${(data.durationMs / 1000).toFixed(1)}s)` 
          }])
          break
        case 'error':
          setIsRunning(false)
          setLogs(prev => [...prev, { type: 'error', message: data.message }])
          break
        case 'stopped':
          setIsRunning(false)
          setLogs(prev => [...prev, { type: 'warning', message: data.message }])
          break
      }
    }

    ws.onerror = (error) => {
      console.error('[SkillRunner] WebSocket error:', error)
      setLogs(prev => [...prev, { type: 'error', message: 'WebSocket 连接错误' }])
      setIsRunning(false)
    }

    ws.onclose = () => {
      console.log('[SkillRunner] WebSocket closed')
    }

    wsRef.current = ws
    return ws
  }, [])

  const handleRun = () => {
    if (!skillId) return

    // 验证设备选择
    if ((platform === 'android' || platform === 'ios') && !deviceId) {
      setLogs(prev => [...prev, { type: 'error', message: '请选择设备' }])
      return
    }

    setIsRunning(true)
    setLogs([])
    setScreenshots([])
    setResult(null)

    // 先添加本地日志
    setLogs(prev => [...prev, { type: 'info', message: '正在连接运行服务...' }])

    // WebSocket 直接连接后端（绕过前端代理）
    const wsUrl = `ws://localhost:8080/ws/skill-run`
    console.log('[SkillRunner] Connecting to:', wsUrl)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[SkillRunner] WebSocket connected, sending run request')
      setLogs(prev => [...prev, { type: 'info', message: '已连接，开始运行...' }])
      
      ws.send(JSON.stringify({
        action: 'run',
        skillId,
        platform,
        targetUrl: targetUrl || undefined,
        deviceId: deviceId || undefined,
        headless
      }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('[SkillRunner] Received:', data)

      switch (data.type) {
        case 'connected':
          setLogs(prev => [...prev, { type: 'info', message: data.message }])
          break
        case 'started':
          setLogs(prev => [...prev, { type: 'info', message: data.message }])
          break
        case 'log':
          const logMessage = data.message || data.log || JSON.stringify(data)
          setLogs(prev => [...prev, { type: 'log', message: logMessage }])
          break
        case 'completed':
          setIsRunning(false)
          setResult(data)
          if (data.screenshots) {
            setScreenshots(data.screenshots)
          }
          setLogs(prev => [...prev, { 
            type: data.success ? 'success' : 'error', 
            message: `${data.message} (耗时: ${(data.durationMs / 1000).toFixed(1)}s)` 
          }])
          ws.close()
          break
        case 'error':
          setIsRunning(false)
          setLogs(prev => [...prev, { type: 'error', message: data.message }])
          ws.close()
          break
        case 'stopped':
          setIsRunning(false)
          setLogs(prev => [...prev, { type: 'warning', message: data.message }])
          ws.close()
          break
      }
    }

    ws.onerror = (error) => {
      console.error('[SkillRunner] WebSocket error:', error)
      setLogs(prev => [...prev, { type: 'error', message: 'WebSocket 连接错误' }])
      setIsRunning(false)
    }

    ws.onclose = () => {
      console.log('[SkillRunner] WebSocket closed')
    }
  }

  const handleStop = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'stop' }))
    }
  }

  const clearLogs = () => {
    setLogs([])
    setScreenshots([])
    setResult(null)
  }

  // 渲染设备选择器
  const renderDeviceSelector = () => {
    if (platform === 'android') {
      if (androidDevices.length === 0) {
        return (
          <div className="text-amber-400 text-xs">
            ⚠️ 未检测到 Android 设备
            <button 
              onClick={loadAndroidDevices}
              disabled={loadingDevices}
              className="ml-2 text-blue-400 hover:underline"
            >
              {loadingDevices ? '刷新中...' : '刷新'}
            </button>
          </div>
        )
      }
      return (
        <div className="space-y-1">
          <label className="text-slate-400 text-xs flex items-center justify-between">
            <span>选择设备</span>
            <button 
              onClick={loadAndroidDevices}
              disabled={loadingDevices}
              className="text-blue-400 hover:underline text-xs"
            >
              {loadingDevices ? '刷新中...' : '刷新'}
            </button>
          </label>
          <select
            value={deviceId}
            onChange={e => setDeviceId(e.target.value)}
            disabled={isRunning}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none disabled:opacity-50"
          >
            {androidDevices.map(device => (
              <option key={device.id} value={device.id}>
                {device.model} ({device.id.substring(0, 8)}...)
              </option>
            ))}
          </select>
          {deviceId && (
            <div className="text-xs text-slate-500">
              状态: <span className={androidDevices.find(d => d.id === deviceId)?.state === 'device' ? 'text-green-400' : 'text-amber-400'}>
                {androidDevices.find(d => d.id === deviceId)?.state || 'unknown'}
              </span>
            </div>
          )}
        </div>
      )
    }

    if (platform === 'ios') {
      if (iosDevices.length === 0) {
        return (
          <div className="text-amber-400 text-xs">
            ⚠️ 未检测到 iOS 设备
            <button 
              onClick={loadIosDevices}
              disabled={loadingDevices}
              className="ml-2 text-blue-400 hover:underline"
            >
              {loadingDevices ? '刷新中...' : '刷新'}
            </button>
          </div>
        )
      }
      return (
        <div className="space-y-1">
          <label className="text-slate-400 text-xs flex items-center justify-between">
            <span>选择设备</span>
            <button 
              onClick={loadIosDevices}
              disabled={loadingDevices}
              className="text-blue-400 hover:underline text-xs"
            >
              {loadingDevices ? '刷新中...' : '刷新'}
            </button>
          </label>
          <select
            value={deviceId}
            onChange={e => setDeviceId(e.target.value)}
            disabled={isRunning}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none disabled:opacity-50"
          >
            {iosDevices.map(device => (
              <option key={device.id} value={device.id}>
                {device.model}
              </option>
            ))}
          </select>
        </div>
      )
    }

    return null
  }

  // 判断是否可运行
  const canRun = () => {
    if (!skillId || isRunning) return false
    if (platform === 'android' || platform === 'ios') {
      return !!deviceId
    }
    return true
  }

  return (
    <div className="space-y-4">
      {/* 配置面板 */}
      <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-medium flex items-center gap-2">
            🧪 运行验证
            <span className="text-xs px-2 py-0.5 bg-slate-700 rounded-full text-slate-400 uppercase">
              {platform}
            </span>
          </h3>
          
          {result && (
            <span className={`text-xs px-2 py-1 rounded ${result.success ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
              {result.success ? '✓ 成功' : '✗ 失败'}
            </span>
          )}
        </div>

        {/* 平台切换（如果 Skill 支持多平台） */}
        <div className="flex gap-2">
          {['browser', 'android', 'ios', 'computer'].map(p => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              disabled={isRunning}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                platform === p 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              } disabled:opacity-50`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Browser 配置 */}
        {platform === 'browser' && (
          <>
            <div className="space-y-1">
              <label className="text-slate-400 text-xs">目标网址（可选）</label>
              <input
                type="text"
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="https://example.com"
                disabled={isRunning}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 outline-none disabled:opacity-50"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="headless"
                checked={headless}
                onChange={e => setHeadless(e.target.checked)}
                disabled={isRunning}
                className="rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="headless" className="text-slate-300 text-sm cursor-pointer select-none">
                无头模式（不显示浏览器窗口）
              </label>
            </div>
          </>
        )}

        {/* Android/iOS 设备选择 */}
        {(platform === 'android' || platform === 'ios') && renderDeviceSelector()}

        {/* Computer 平台提示 */}
        {platform === 'computer' && (
          <div className="text-amber-200/70 text-xs bg-amber-900/20 rounded-lg p-2">
            💡 Computer 平台将控制当前桌面
          </div>
        )}

        {/* 控制按钮 */}
        <div className="flex gap-2 pt-2">
          {isRunning ? (
            <button
              onClick={handleStop}
              className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              停止运行
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={!canRun()}
              className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              ▶ 运行验证
            </button>
          )}
          
          <button
            onClick={clearLogs}
            disabled={isRunning || logs.length === 0}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-sm rounded-lg transition-colors"
          >
            清空
          </button>
        </div>

        {!canRun() && !isRunning && (platform === 'android' || platform === 'ios') && (
          <p className="text-amber-400 text-xs">请先连接设备</p>
        )}
      </div>

      {/* 截图预览 */}
      {screenshots.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4">
          <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-3">
            执行截图 ({screenshots.length})
          </h4>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {screenshots.map((shot, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={`data:image/png;base64,${shot.base64Image}`}
                  alt={shot.label}
                  className="w-full rounded-lg border border-slate-700"
                />
                <span className="absolute top-1 left-1 text-xs bg-black/70 text-white px-1.5 py-0.5 rounded">
                  {shot.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 日志输出 */}
      {logs.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">运行日志</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs">{logs.length} 条</span>
              {isRunning && (
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
          </div>
          <div className="p-2 max-h-80 overflow-y-auto font-mono text-xs space-y-0.5">
            {logs.map((log, idx) => {
              const typeColors = {
                error: 'text-red-400 bg-red-900/10',
                success: 'text-green-400 bg-green-900/10',
                warning: 'text-amber-400 bg-amber-900/10',
                info: 'text-blue-400 bg-blue-900/10',
                log: 'text-slate-300'
              }
              const typeIcons = {
                error: '❌',
                success: '✅',
                warning: '⚠️',
                info: 'ℹ️',
                log: '📝'
              }
              return (
                <div
                  key={idx}
                  className={`break-all py-0.5 px-1 rounded ${typeColors[log.type] || typeColors.log}`}
                >
                  <span className="text-slate-600 mr-1 select-none">{idx + 1}.</span>
                  <span className="mr-1 select-none">{typeIcons[log.type] || '📝'}</span>
                  {log.message}
                </div>
              )
            })}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}
