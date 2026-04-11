import api from './client'

export interface ImageData {
  id: string
  filename: string
  width: number
  height: number
  modality: string
  body_region: string | null
  is_expert_ground_truth: boolean
  priority_score: number
  created_at: string
  uploaded_by: string | null
}

export interface LandmarkDefinition {
  id: string
  name: string
  display_name: string
  body_region: string
  description: string | null
  sort_order: number
}

export async function listImages(params?: {
  body_region?: string
  is_ground_truth?: boolean
  skip?: number
  limit?: number
}): Promise<{ images: ImageData[]; total: number }> {
  const { data } = await api.get('/images', { params })
  return data
}

export async function getNextTask(body_region?: string): Promise<ImageData> {
  const { data } = await api.get('/images/next-task', { params: { body_region } })
  return data
}

export async function getImage(id: string): Promise<ImageData> {
  const { data } = await api.get(`/images/${id}`)
  return data
}

export function getImageFileUrl(id: string): string {
  return `/api/images/${id}/file`
}

export async function uploadImage(file: File, bodyRegion?: string, isGroundTruth?: boolean): Promise<ImageData> {
  const formData = new FormData()
  formData.append('file', file)
  if (bodyRegion) formData.append('body_region', bodyRegion)
  if (isGroundTruth) formData.append('is_expert_ground_truth', 'true')
  const { data } = await api.post('/images', formData)
  return data
}

export async function listLandmarks(body_region?: string): Promise<LandmarkDefinition[]> {
  const { data } = await api.get('/landmarks', { params: { body_region } })
  return data
}
