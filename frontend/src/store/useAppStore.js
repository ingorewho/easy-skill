import { create } from 'zustand'

const useAppStore = create((set, get) => ({
  // ========== Video state ==========
  videoId: null,
  videoFilename: null,
  videoDuration: 0,
  setVideo: (videoId, filename, duration) => set({ videoId, videoFilename: filename, videoDuration: duration }),

  // ========== Frames state ==========
  frames: [], // { frameId, timestamp, base64Image, description, annotationJson }
  setFrames: (frames) => set({ frames }),
  addFrames: (newFrames) => set((s) => ({
    frames: [...s.frames, ...newFrames.filter(f => !s.frames.find(e => e.frameId === f.frameId))]
  })),
  updateFrameDescription: (frameId, description) => set((s) => ({
    frames: s.frames.map(f => f.frameId === frameId ? { ...f, description } : f)
  })),
  updateFrameAnnotation: (frameId, annotationJson) => set((s) => ({
    frames: s.frames.map(f => f.frameId === frameId ? { ...f, annotationJson } : f)
  })),
  updateFrameImage: (frameId, base64Image) => set((s) => ({
    frames: s.frames.map(f => f.frameId === frameId ? { ...f, base64Image } : f)
  })),
  removeFrame: (frameId) => set((s) => ({
    frames: s.frames.filter(f => f.frameId !== frameId)
  })),
  moveFrame: (frameId, direction) => set((s) => {
    const index = s.frames.findIndex(f => f.frameId === frameId)
    if (index === -1) return { frames: s.frames }
    
    const newIndex = direction === 'left' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= s.frames.length) return { frames: s.frames }
    
    const newFrames = [...s.frames]
    const [removed] = newFrames.splice(index, 1)
    newFrames.splice(newIndex, 0, removed)
    return { frames: newFrames }
  }),
  reorderFrames: (newFrames) => set({ frames: newFrames }),

  // ========== Selected frame for annotation ==========
  selectedFrameId: null,
  setSelectedFrameId: (frameId) => set({ selectedFrameId: frameId }),

  // ========== Requirement ==========
  requirement: '',
  setRequirement: (requirement) => set({ requirement }),

  // ========== Skill state ==========
  skillId: null,
  skillName: null,
  skillFiles: [], // { name, path, content }
  skillVariables: [], // { name, label, defaultValue, type }
  setSkill: (skillId, skillName, files, variables = []) => set({ skillId, skillName, skillFiles: files, skillVariables: variables }),
  updateSkillFileContent: (path, content) => set((s) => ({
    skillFiles: s.skillFiles.map(f => f.path === path ? { ...f, content } : f)
  })),

  // ========== Skill list (history) ==========
  skillList: [],
  setSkillList: (list) => set({ skillList: list }),

  // ========== Active tab in playground ==========
  activeTab: 'annotate',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // ========== AI loading ==========
  isGenerating: false,
  setIsGenerating: (v) => set({ isGenerating: v }),

  // ========== Regeneration state ==========
  regeneration: {
    isRegenerating: false,
    showPanel: false,           // 显示重新生成面板
    showComparison: false,      // 显示对比视图
    showPartialPanel: false,    // 显示局部重新生成面板
    candidate: null,            // 候选代码 { skillId, skillName, files, variables }
    history: [],                // 历史版本列表
    iteration: 0,               // 当前迭代次数
    additionalPrompt: '',       // 用户输入的补充要求
    requirement: '',            // 原始诉求（备份）
    partialConfig: {           // 局部重新生成配置
      selectedFrameIds: [],    // 选中的帧ID
      selectedCodeRange: null, // 选中的代码范围
      mode: 'auto',            // 生成模式: auto | text | multimodal
    }
  },

  // 打开重新生成面板
  openRegenerationPanel: () => set((s) => ({
    regeneration: {
      ...s.regeneration,
      showPanel: true,
      requirement: s.requirement, // 备份当前诉求
    }
  })),

  // 关闭重新生成面板
  closeRegenerationPanel: () => set((s) => ({
    regeneration: {
      ...s.regeneration,
      showPanel: false,
    }
  })),

  // 设置补充要求
  setAdditionalPrompt: (text) => set((s) => ({
    regeneration: { ...s.regeneration, additionalPrompt: text }
  })),

  // 开始重新生成
  startRegeneration: () => set((s) => ({
    regeneration: { ...s.regeneration, isRegenerating: true }
  })),

  // 设置候选代码（生成完成）
  setRegenerationCandidate: (candidate, history, iteration) => set((s) => ({
    regeneration: {
      ...s.regeneration,
      candidate,
      history,
      iteration,
      isRegenerating: false,
      showComparison: true, // 自动生成后显示对比
    }
  })),

  // 接受候选代码
  acceptCandidate: () => set((s) => {
    const { candidate, history, iteration } = s.regeneration
    if (!candidate) return s
    
    return {
      skillFiles: candidate.files,
      skillName: candidate.skillName,
      skillVariables: candidate.variables || [],
      regeneration: {
        ...s.regeneration,
        candidate: null,
        showComparison: false,
        showPanel: false,
        additionalPrompt: '', // 清空输入
      }
    }
  }),

  // 放弃候选代码
  discardCandidate: () => set((s) => ({
    regeneration: {
      ...s.regeneration,
      candidate: null,
      showComparison: false,
    }
  })),

  // 切换对比视图显示
  setShowComparison: (show) => set((s) => ({
    regeneration: { ...s.regeneration, showComparison: show }
  })),

  // 重置重新生成状态
  resetRegeneration: () => set((s) => ({
    regeneration: {
      isRegenerating: false,
      showPanel: false,
      showComparison: false,
      showPartialPanel: false,
      candidate: null,
      history: [],
      iteration: 0,
      additionalPrompt: '',
      requirement: '',
      partialConfig: {
        selectedFrameIds: [],
        selectedCodeRange: null,
        mode: 'auto',
      }
    }
  })),

  // ========== 局部重新生成相关 ==========
  
  // 打开局部重新生成面板
  openPartialRegeneratePanel: () => set((s) => ({
    regeneration: { ...s.regeneration, showPartialPanel: true }
  })),
  
  // 关闭局部重新生成面板
  closePartialRegeneratePanel: () => set((s) => ({
    regeneration: { ...s.regeneration, showPartialPanel: false }
  })),
  
  // 设置局部重新生成配置
  setPartialRegenerateConfig: (config) => set((s) => ({
    regeneration: {
      ...s.regeneration,
      partialConfig: { ...s.regeneration.partialConfig, ...config }
    }
  })),
  
  // 切换局部重新生成面板
  togglePartialRegeneratePanel: () => set((s) => ({
    regeneration: {
      ...s.regeneration,
      showPartialPanel: !s.regeneration.showPartialPanel
    }
  })),

  // ========== Reset for new session ==========
  reset: () => set({
    videoId: null, videoFilename: null, videoDuration: 0,
    frames: [], selectedFrameId: null, requirement: '',
    skillId: null, skillName: null, skillFiles: [], skillVariables: [],
    activeTab: 'annotate', isGenerating: false,
    regeneration: {
      isRegenerating: false,
      showPanel: false,
      showComparison: false,
      showPartialPanel: false,
      candidate: null,
      history: [],
      iteration: 0,
      additionalPrompt: '',
      requirement: '',
      partialConfig: {
        selectedFrameIds: [],
        selectedCodeRange: null,
        mode: 'auto',
      }
    }
  }),
}))

export default useAppStore
