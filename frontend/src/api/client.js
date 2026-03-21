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
