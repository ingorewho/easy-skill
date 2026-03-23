import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  timeout: 120000,
})

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.message || err.message || 'Request failed'
    return Promise.reject(new Error(msg))
  }
)

export const uploadVideo = (file, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  return client.post('/videos/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded * 100) / e.total)),
  })
}

export const extractFramesAuto = (videoId, intervalSeconds = 3) =>
  client.post(`/videos/${videoId}/frames/auto`, { intervalSeconds })

export const extractFramesManual = (videoId, timestamps) =>
  client.post(`/videos/${videoId}/frames/manual`, { timestamps })

export const generateSkill = (payload) =>
  client.post('/skills/generate', payload)

export const getSkill = (skillId) =>
  client.get(`/skills/${skillId}`)

export const updateSkillFile = (skillId, path, content) =>
  client.put(`/skills/${skillId}/files`, { path, content })

export const getVideoStreamUrl = (videoId) =>
  `/api/videos/${videoId}/stream`

export const getSkillExportUrl = (skillId) =>
  `/api/skills/${skillId}/export`

export const fetchSkillList = () =>
  client.get('/skills')

export const deleteSkill = (skillId) =>
  client.delete(`/skills/${skillId}`)

export const deploySkill = (skillId) =>
  client.post(`/skills/${skillId}/deploy`)

export const fetchAndroidDevices = () =>
  client.get('/devices/android')

export const fetchIosDevices = () =>
  client.get('/devices/ios')

export const fetchAllDevices = () =>
  client.get('/devices')

// ==================== 归档 API ====================

// 视频归档
export const saveVideoArchive = (videoId, description) =>
  client.post('/archives/videos', { videoId, description })

export const fetchVideoArchives = () =>
  client.get('/archives/videos')

export const deleteVideoArchive = (id) =>
  client.delete(`/archives/videos/${id}`)

// 帧归档
export const saveFrameArchive = (data) =>
  client.post('/archives/frames', data)

export const fetchFrameArchives = () =>
  client.get('/archives/frames')

export const fetchFramesByVideo = (videoArchiveId) =>
  client.get(`/archives/frames/video/${videoArchiveId}`)

export const deleteFrameArchive = (id) =>
  client.delete(`/archives/frames/${id}`)

// 诉求历史
export const saveRequirement = (content, frameIds, platform) =>
  client.post('/archives/requirements', { content, frameIds, platform })

export const fetchRequirementHistory = () =>
  client.get('/archives/requirements')

export const fetchRecentRequirements = () =>
  client.get('/archives/requirements/recent')

export const updateRequirementUseCount = (id) =>
  client.put(`/archives/requirements/${id}/use`)

export const deleteRequirement = (id) =>
  client.delete(`/archives/requirements/${id}`)
