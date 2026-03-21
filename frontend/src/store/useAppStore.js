import { create } from 'zustand'

const useAppStore = create((set, get) => ({
  // Video state
  videoId: null,
  videoFilename: null,
  videoDuration: 0,
  setVideo: (videoId, filename, duration) => set({ videoId, videoFilename: filename, videoDuration: duration }),

  // Frames state
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

  // Selected frame for annotation
  selectedFrameId: null,
  setSelectedFrameId: (frameId) => set({ selectedFrameId: frameId }),

  // Requirement
  requirement: '',
  setRequirement: (requirement) => set({ requirement }),

  // Skill state
  skillId: null,
  skillName: null,
  skillFiles: [], // { name, path, content }
  setSkill: (skillId, skillName, files) => set({ skillId, skillName, skillFiles: files }),
  updateSkillFileContent: (path, content) => set((s) => ({
    skillFiles: s.skillFiles.map(f => f.path === path ? { ...f, content } : f)
  })),

  // Skill list (history)
  skillList: [],
  setSkillList: (list) => set({ skillList: list }),

  // Active tab in playground: 'annotate' | 'skill'
  activeTab: 'annotate',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // AI loading
  isGenerating: false,
  setIsGenerating: (v) => set({ isGenerating: v }),

  // Reset for new session
  reset: () => set({
    videoId: null, videoFilename: null, videoDuration: 0,
    frames: [], selectedFrameId: null, requirement: '',
    skillId: null, skillName: null, skillFiles: [],
    activeTab: 'annotate', isGenerating: false,
  }),
}))

export default useAppStore
