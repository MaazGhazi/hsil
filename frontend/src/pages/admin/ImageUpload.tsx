import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadImage } from '../../api/images'

const BODY_REGIONS = [
  { value: 'oblique_lumbar', label: 'Oblique Lumbar Spine' },
  { value: 'ap_lumbar', label: 'AP Lumbar Spine' },
  { value: 'lateral_lumbar', label: 'Lateral Lumbar Spine' },
  { value: 'ap_pelvis', label: 'AP Pelvis' },
]

export function ImageUploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [bodyRegion, setBodyRegion] = useState('oblique_lumbar')
  const [isGroundTruth, setIsGroundTruth] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<{ name: string; ok: boolean; error?: string }[]>([])
  const navigate = useNavigate()

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/')
    )
    setFiles(prev => [...prev, ...dropped])
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const handleUpload = async () => {
    setUploading(true)
    const newResults: typeof results = []

    for (const file of files) {
      try {
        await uploadImage(file, bodyRegion, isGroundTruth)
        newResults.push({ name: file.name, ok: true })
      } catch (err: any) {
        newResults.push({ name: file.name, ok: false, error: err.response?.data?.detail || 'Upload failed' })
      }
    }

    setResults(newResults)
    setUploading(false)
    setFiles([])
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Images</h2>

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

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isGroundTruth}
            onChange={(e) => setIsGroundTruth(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-gray-700">Mark as expert ground truth</span>
        </label>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400"
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <p className="text-gray-500 text-sm">
            Drag & drop images here, or click to select
          </p>
          <input
            id="file-input"
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {files.length > 0 && (
          <div className="text-sm text-gray-600">
            {files.length} file{files.length !== 1 ? 's' : ''} selected:
            <ul className="mt-1 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span>{f.name}</span>
                  <button
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} image${files.length !== 1 ? 's' : ''}`}
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50"
          >
            Back
          </button>
        </div>

        {results.length > 0 && (
          <div className="space-y-1 text-sm">
            {results.map((r, i) => (
              <div key={i} className={r.ok ? 'text-green-700' : 'text-red-600'}>
                {r.name}: {r.ok ? 'Uploaded' : r.error}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
