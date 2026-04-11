import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { predictLandmarks, type PredictionResult } from '../../api/inference'
import { OverlayView } from '../../components/overlay/OverlayView'

const BODY_REGIONS = [
  { value: 'oblique_lumbar', label: 'Oblique Lumbar Spine' },
  { value: 'ap_lumbar', label: 'AP Lumbar Spine' },
  { value: 'lateral_lumbar', label: 'Lateral Lumbar Spine' },
  { value: 'ap_pelvis', label: 'AP Pelvis' },
]

export function SurgeonDashboard() {
  const [bodyRegion, setBodyRegion] = useState('oblique_lumbar')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<PredictionResult | null>(null)

  const mutation = useMutation({
    mutationFn: (args: { file: File; bodyRegion: string }) =>
      predictLandmarks(args.file, args.bodyRegion),
    onSuccess: (data) => setResult(data),
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreviewUrl(URL.createObjectURL(file))
      setResult(null)
    }
  }

  const handleAnalyze = () => {
    if (!imageFile) return
    mutation.mutate({ file: imageFile, bodyRegion })
  }

  const handleReset = () => {
    setImageFile(null)
    setImagePreviewUrl(null)
    setResult(null)
  }

  // Show overlay view if we have results
  if (result && imagePreviewUrl) {
    return (
      <div className="h-[calc(100vh-80px)]">
        <OverlayView
          imageUrl={imagePreviewUrl}
          imageWidth={result.image_width}
          imageHeight={result.image_height}
          predictions={result.predictions}
          onBack={handleReset}
        />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Surgical Landmark Overlay</h2>
      <p className="text-gray-600 mb-8">
        Upload a fluoroscopy image and the AI will identify anatomical landmarks.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Body Region</label>
          <select
            value={bodyRegion}
            onChange={(e) => setBodyRegion(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {BODY_REGIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fluoroscopy Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:rounded-md"
          />
        </div>

        {imagePreviewUrl && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <img src={imagePreviewUrl} alt="Preview" className="max-h-64 mx-auto" />
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={!imageFile || mutation.isPending}
          className="px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50"
        >
          {mutation.isPending ? 'Analyzing...' : 'Analyze Image'}
        </button>

        {mutation.isError && (
          <p className="text-sm text-red-600">Analysis failed. Please try again.</p>
        )}
      </div>
    </div>
  )
}
