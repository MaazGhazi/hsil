import api from './client'

export interface LandmarkPrediction {
  landmark_name: string
  display_name: string
  x: number
  y: number
  confidence: number
}

export interface PredictionResult {
  id: string
  image_id: string
  image_width: number
  image_height: number
  predictions: LandmarkPrediction[]
}

export async function predictLandmarks(file: File, bodyRegion: string): Promise<PredictionResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('body_region', bodyRegion)
  const { data } = await api.post('/inference/predict', formData)
  return data
}
