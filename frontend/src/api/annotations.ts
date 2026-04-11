import api from './client'

export interface AnnotationData {
  id: string
  image_id: string
  user_id: string
  annotation_type: string
  landmark_def_id: string | null
  data: { x: number; y: number } | { points: number[][]; type: string }
  is_expert: boolean
  status: string
  created_at: string
}

export interface AnnotationCreate {
  landmark_def_id: string
  annotation_type: string
  data: Record<string, unknown>
}

export interface AnnotationStats {
  total_annotations: number
  images_labeled: number
  accuracy_score: number | null
}

export async function submitAnnotations(imageId: string, annotations: AnnotationCreate[]): Promise<AnnotationData[]> {
  const { data } = await api.post(`/images/${imageId}/annotations`, { annotations })
  return data
}

export async function getAnnotations(imageId: string): Promise<AnnotationData[]> {
  const { data } = await api.get(`/images/${imageId}/annotations`)
  return data
}

export async function getMyStats(): Promise<AnnotationStats> {
  const { data } = await api.get('/annotations/my-stats')
  return data
}
