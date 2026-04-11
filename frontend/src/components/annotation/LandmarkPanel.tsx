import type { LandmarkDefinition } from '../../api/images'

interface PlacedLandmark {
  landmarkDefId: string
  x: number
  y: number
}

interface Props {
  landmarks: LandmarkDefinition[]
  placedLandmarks: PlacedLandmark[]
  selectedLandmarkId: string | null
  onSelect: (id: string | null) => void
}

const COLORS = [
  '#22d3ee', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]

export function LandmarkPanel({ landmarks, placedLandmarks, selectedLandmarkId, onSelect }: Props) {
  const placedMap = new Map(placedLandmarks.map(p => [p.landmarkDefId, p]))
  const placedCount = placedLandmarks.length
  const totalCount = landmarks.length

  return (
    <div className="p-3">
      <div className="text-xs text-gray-500 mb-3">
        {placedCount} / {totalCount} landmarks placed
      </div>

      <div className="space-y-1">
        {landmarks.map((landmark, i) => {
          const placed = placedMap.get(landmark.id)
          const isSelected = selectedLandmarkId === landmark.id
          const color = COLORS[i % COLORS.length]

          return (
            <button
              key={landmark.id}
              onClick={() => onSelect(isSelected ? null : landmark.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                isSelected
                  ? 'bg-gray-100 ring-1 ring-gray-300'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full border-2 border-white"
                  style={{
                    backgroundColor: placed ? color : 'transparent',
                    borderColor: color,
                  }}
                />
                <span className={placed ? 'text-gray-900' : 'text-gray-500'}>
                  {landmark.display_name}
                </span>
              </div>
              {placed && (
                <div className="text-xs text-gray-400 ml-5 mt-0.5">
                  ({Math.round(placed.x)}, {Math.round(placed.y)})
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
