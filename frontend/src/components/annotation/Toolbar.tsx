interface Props {
  zoom: number
  onZoomChange: (zoom: number) => void
  brightness: number
  onBrightnessChange: (v: number) => void
  contrast: number
  onContrastChange: (v: number) => void
  onUndo: () => void
  canUndo: boolean
}

export function Toolbar({
  zoom, onZoomChange,
  brightness, onBrightnessChange,
  contrast, onContrastChange,
  onUndo, canUndo,
}: Props) {
  return (
    <div className="bg-gray-800 text-white px-4 py-2 flex items-center gap-6 text-sm">
      {/* Zoom */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))}
          className="px-2 py-0.5 bg-gray-700 rounded hover:bg-gray-600"
        >
          -
        </button>
        <span className="w-14 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => onZoomChange(Math.min(4, zoom + 0.25))}
          className="px-2 py-0.5 bg-gray-700 rounded hover:bg-gray-600"
        >
          +
        </button>
        <button
          onClick={() => onZoomChange(1)}
          className="px-2 py-0.5 bg-gray-700 rounded hover:bg-gray-600 text-xs"
        >
          Fit
        </button>
      </div>

      <div className="w-px h-5 bg-gray-600" />

      {/* Brightness */}
      <div className="flex items-center gap-2">
        <label className="text-gray-400 text-xs">Brightness</label>
        <input
          type="range"
          min={50}
          max={200}
          value={brightness}
          onChange={(e) => onBrightnessChange(Number(e.target.value))}
          className="w-20 h-1"
        />
      </div>

      {/* Contrast */}
      <div className="flex items-center gap-2">
        <label className="text-gray-400 text-xs">Contrast</label>
        <input
          type="range"
          min={50}
          max={200}
          value={contrast}
          onChange={(e) => onContrastChange(Number(e.target.value))}
          className="w-20 h-1"
        />
      </div>

      <div className="w-px h-5 bg-gray-600" />

      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="px-2 py-0.5 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"
      >
        Undo
      </button>
    </div>
  )
}
