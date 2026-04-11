import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNextTask, getImageFileUrl, listLandmarks, type ImageData } from '../../api/images'
import { submitAnnotations, getAnnotations, type AnnotationCreate } from '../../api/annotations'
import { ImageCanvas } from '../../components/annotation/ImageCanvas'
import { useAuth } from '../../hooks/useAuth'
import api from '../../api/client'

interface PlacedLandmark {
  landmarkDefId: string
  x: number      // top-left x in image pixels
  y: number      // top-left y
  w: number      // width
  h: number      // height
}

type Tool = 'cursor' | 'point'

const COLORS = [
  '#22d3ee', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]

export function AnnotationWorkspace() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [currentImage, setCurrentImage] = useState<ImageData | null>(null)
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<string | null>(null)
  const [placedLandmarks, setPlacedLandmarks] = useState<PlacedLandmark[]>([])
  const [activeTool, setActiveTool] = useState<Tool>('point')
  const [zoom, setZoom] = useState(1)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [showSettings, setShowSettings] = useState(false)
  const [xpToast, setXpToast] = useState<{ xp: number; streak: number; levelUp?: number } | null>(null)
  const [showCommunity, setShowCommunity] = useState(false)
  const [communityBoxes, setCommunityBoxes] = useState<any>(null)
  const [, setLastSubmittedImageId] = useState<string | null>(null)
  const { invalidate: refreshAuth } = useAuth()

  const { data: nextImage, isLoading: loadingImage, refetch: refetchNext } = useQuery({
    queryKey: ['next-task'],
    queryFn: () => getNextTask(),
    retry: false,
  })

  const { data: landmarks } = useQuery({
    queryKey: ['landmarks', currentImage?.body_region],
    queryFn: () => listLandmarks(currentImage?.body_region ?? undefined),
    enabled: !!currentImage?.body_region,
  })

  const { data: existingAnnotations } = useQuery({
    queryKey: ['annotations', currentImage?.id],
    queryFn: () => getAnnotations(currentImage!.id),
    enabled: !!currentImage?.id,
  })

  useEffect(() => {
    if (nextImage) setCurrentImage(nextImage)
  }, [nextImage])

  useEffect(() => {
    if (existingAnnotations && existingAnnotations.length > 0) {
      setPlacedLandmarks(
        existingAnnotations
          .filter(a => a.landmark_def_id && a.annotation_type === 'keypoint')
          .map(a => {
            const d = a.data as any
            // Support both old point format and new bbox format
            if (d.w !== undefined) {
              return { landmarkDefId: a.landmark_def_id!, x: d.x, y: d.y, w: d.w, h: d.h }
            }
            // Convert old point to a default box
            const size = 40
            return { landmarkDefId: a.landmark_def_id!, x: d.x - size / 2, y: d.y - size / 2, w: size, h: size }
          })
      )
    } else {
      setPlacedLandmarks([])
    }
  }, [existingAnnotations])

  const submitMutation = useMutation({
    mutationFn: (args: { imageId: string; annotations: AnnotationCreate[] }) =>
      submitAnnotations(args.imageId, args.annotations),
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['my-stats'] })
      refreshAuth()

      // Show XP toast
      if (data?.xp) {
        setXpToast({
          xp: data.xp.xp_earned ?? 0,
          streak: data.xp.streak ?? 0,
          levelUp: data.xp.level_up,
        })
        setTimeout(() => setXpToast(null), 3000)
      }

      // Fetch community annotations for feedback
      const imgId = currentImage?.id
      if (imgId) {
        setLastSubmittedImageId(imgId)
        try {
          const { data: community } = await api.get(`/images/${imgId}/community`)
          if (community.total_other_annotators > 0) {
            setCommunityBoxes(community)
            setShowCommunity(true)
            // Auto-dismiss after 6 seconds and load next
            setTimeout(() => {
              setShowCommunity(false)
              setCommunityBoxes(null)
              setPlacedLandmarks([])
              setSelectedLandmarkId(null)
              refetchNext()
            }, 6000)
            return
          }
        } catch { /* No community data yet, that's fine */ }
      }

      setPlacedLandmarks([])
      setSelectedLandmarkId(null)
      refetchNext()
    },
  })

  // Called when user finishes drawing a bounding box (mousedown → drag → mouseup)
  const handleBoxDraw = useCallback((x: number, y: number, w: number, h: number) => {
    if (activeTool !== 'point' || !selectedLandmarkId) return
    setPlacedLandmarks(prev => {
      const existing = prev.findIndex(p => p.landmarkDefId === selectedLandmarkId)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], x, y, w, h }
        return updated
      }
      return [...prev, { landmarkDefId: selectedLandmarkId, x, y, w, h }]
    })
    // Auto-advance to next unplaced landmark
    if (landmarks) {
      const currentIdx = landmarks.findIndex(l => l.id === selectedLandmarkId)
      const nextUnplaced = landmarks.find((l, i) =>
        i > currentIdx && !placedLandmarks.some(p => p.landmarkDefId === l.id) && l.id !== selectedLandmarkId
      )
      if (nextUnplaced) setSelectedLandmarkId(nextUnplaced.id)
    }
  }, [activeTool, selectedLandmarkId, landmarks, placedLandmarks])

  const handleLandmarkDrag = useCallback((landmarkDefId: string, x: number, y: number) => {
    setPlacedLandmarks(prev =>
      prev.map(p => p.landmarkDefId === landmarkDefId ? { ...p, x, y } : p)
    )
  }, [])

  const handleLandmarkResize = useCallback((landmarkDefId: string, w: number, h: number) => {
    setPlacedLandmarks(prev =>
      prev.map(p => p.landmarkDefId === landmarkDefId ? { ...p, w, h } : p)
    )
  }, [])

  const handleSubmit = () => {
    if (!currentImage || placedLandmarks.length === 0) return
    const annotations: AnnotationCreate[] = placedLandmarks.map(p => ({
      landmark_def_id: p.landmarkDefId,
      annotation_type: 'keypoint',
      data: { x: p.x, y: p.y, w: p.w, h: p.h },
    }))
    submitMutation.mutate({ imageId: currentImage.id, annotations })
  }

  const handleSkip = () => {
    setPlacedLandmarks([])
    setSelectedLandmarkId(null)
    refetchNext()
  }

  const handleUndo = () => setPlacedLandmarks(prev => prev.slice(0, -1))

  const handleDeleteLandmark = (id: string) => {
    setPlacedLandmarks(prev => prev.filter(p => p.landmarkDefId !== id))
  }

  if (loadingImage) {
    return <div className="flex items-center justify-center h-screen bg-[#1a1a2e] text-gray-400">Loading next image...</div>
  }

  if (!currentImage) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#1a1a2e] text-gray-400">
        <p className="text-lg mb-4">No more images to label</p>
        <button onClick={() => navigate('/labeling')} className="text-cyan-400 hover:underline text-sm">
          Back to dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[#1a1a2e] -m-6">
      {/* === TOP BAR === */}
      <div className="h-10 bg-[#141424] border-b border-[#2a2a4a] flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/labeling')} className="text-gray-400 hover:text-white text-xs flex items-center gap-1">
            <span>&larr;</span> Back
          </button>
          <div className="w-px h-4 bg-[#2a2a4a]" />
          <span className="text-gray-300 text-xs font-medium">{currentImage.filename}</span>
          <span className="text-gray-500 text-xs">{currentImage.body_region?.replace(/_/g, ' ')} &middot; {currentImage.width}&times;{currentImage.height}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">{placedLandmarks.length}/{landmarks?.length ?? 0} labeled</span>
          <button
            onClick={handleSkip}
            className="px-3 py-1 text-xs text-gray-400 hover:text-white border border-[#2a2a4a] rounded hover:border-gray-500"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={placedLandmarks.length === 0 || submitMutation.isPending}
            className="px-3 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-500 disabled:opacity-40"
          >
            {submitMutation.isPending ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* === LEFT TOOLS SIDEBAR === */}
        <div className="w-11 bg-[#141424] border-r border-[#2a2a4a] flex flex-col items-center py-2 gap-1 shrink-0">
          {/* Cursor tool */}
          <button
            onClick={() => setActiveTool('cursor')}
            title="Move (V)"
            className={`w-8 h-8 rounded flex items-center justify-center text-sm ${
              activeTool === 'cursor' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-[#2a2a4a]'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 1l10 6.5L8.5 9l-2 5L3 1z" />
            </svg>
          </button>
          {/* Point tool */}
          <button
            onClick={() => setActiveTool('point')}
            title="Place landmark (P)"
            className={`w-8 h-8 rounded flex items-center justify-center ${
              activeTool === 'point' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-[#2a2a4a]'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="5" />
              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
            </svg>
          </button>

          <div className="w-6 border-t border-[#2a2a4a] my-1" />

          {/* Zoom controls */}
          <button
            onClick={() => setZoom(z => Math.min(4, z + 0.25))}
            title="Zoom in"
            className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:bg-[#2a2a4a] text-lg"
          >
            +
          </button>
          <span className="text-[10px] text-gray-500">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
            title="Zoom out"
            className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:bg-[#2a2a4a] text-lg"
          >
            &minus;
          </button>
          <button
            onClick={() => setZoom(1)}
            title="Fit to screen"
            className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:bg-[#2a2a4a] text-[10px]"
          >
            Fit
          </button>

          <div className="w-6 border-t border-[#2a2a4a] my-1" />

          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={placedLandmarks.length === 0}
            title="Undo"
            className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:bg-[#2a2a4a] disabled:opacity-30"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 7h7a3 3 0 0 1 0 6H8" />
              <path d="M6 4L3 7l3 3" />
            </svg>
          </button>

          {/* Image settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Image settings"
            className={`w-8 h-8 rounded flex items-center justify-center mt-auto ${
              showSettings ? 'bg-[#2a2a4a] text-white' : 'text-gray-400 hover:bg-[#2a2a4a]'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="3" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" />
            </svg>
          </button>
        </div>

        {/* === CANVAS === */}
        <div className="flex-1 relative overflow-hidden bg-[#0d0d1a]">
          {/* XP Toast */}
          {xpToast && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 float-up pointer-events-none">
              <div className="bg-white rounded-2xl shadow-lg px-6 py-3 text-center border border-gray-100">
                <div className="text-xl font-extrabold text-gray-900">+{xpToast.xp} XP</div>
                {xpToast.streak > 1 && <div className="text-xs text-gray-400">{xpToast.streak} day streak</div>}
                {xpToast.levelUp && <div className="text-xs font-bold text-emerald-500 mt-0.5">Level {xpToast.levelUp}</div>}
              </div>
            </div>
          )}

          {/* Community feedback overlay */}
          {showCommunity && communityBoxes && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
              <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 text-center">
                <div className="text-lg font-bold text-gray-900 mb-1">Community labels</div>
                <div className="text-sm text-gray-400 mb-4">
                  {communityBoxes.total_other_annotators} other annotator{communityBoxes.total_other_annotators !== 1 ? 's' : ''} labeled this image
                </div>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2 mb-5 text-left">
                  {Object.entries(communityBoxes.landmarks as Record<string, { count: number }>).map(([lid, data]) => {
                    const lm = landmarks?.find(l => l.id === lid)
                    return (
                      <div key={lid} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">{lm?.display_name ?? lid}</span>
                        <span className="text-gray-900 font-semibold">{data.count} labels</span>
                      </div>
                    )
                  })}
                </div>
                <button
                  onClick={() => {
                    setShowCommunity(false)
                    setCommunityBoxes(null)
                    setPlacedLandmarks([])
                    setSelectedLandmarkId(null)
                    refetchNext()
                  }}
                  className="bg-gray-900 text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
                >
                  Next image
                </button>
              </div>
            </div>
          )}
          {/* Image settings popover */}
          {showSettings && (
            <div className="absolute top-2 left-2 z-10 bg-[#1e1e36] border border-[#2a2a4a] rounded-lg p-3 w-56 shadow-xl">
              <div className="text-xs text-gray-400 font-medium mb-2">Image Settings</div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Brightness</span><span>{brightness}%</span>
                  </div>
                  <input type="range" min={20} max={250} value={brightness}
                    onChange={e => setBrightness(Number(e.target.value))}
                    className="w-full h-1 accent-cyan-500" />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Contrast</span><span>{contrast}%</span>
                  </div>
                  <input type="range" min={20} max={250} value={contrast}
                    onChange={e => setContrast(Number(e.target.value))}
                    className="w-full h-1 accent-cyan-500" />
                </div>
                <button onClick={() => { setBrightness(100); setContrast(100) }}
                  className="text-[10px] text-cyan-400 hover:underline">
                  Reset
                </button>
              </div>
            </div>
          )}

          <ImageCanvas
            imageUrl={getImageFileUrl(currentImage.id)}
            imageWidth={currentImage.width}
            imageHeight={currentImage.height}
            zoom={zoom}
            brightness={brightness}
            contrast={contrast}
            placedLandmarks={placedLandmarks}
            landmarks={landmarks ?? []}
            selectedLandmarkId={selectedLandmarkId}
            onBoxDraw={handleBoxDraw}
            onLandmarkDrag={handleLandmarkDrag}
            onLandmarkResize={handleLandmarkResize}
          />
        </div>

        {/* === RIGHT SIDEBAR — Objects panel === */}
        <div className="w-64 bg-[#141424] border-l border-[#2a2a4a] flex flex-col shrink-0">
          {/* Labels header */}
          <div className="px-3 py-2 border-b border-[#2a2a4a] flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Labels</span>
            <span className="text-[10px] text-gray-500 bg-[#2a2a4a] px-1.5 py-0.5 rounded">
              {placedLandmarks.length}/{landmarks?.length ?? 0}
            </span>
          </div>

          {/* Label list */}
          <div className="flex-1 overflow-y-auto">
            {(landmarks ?? []).map((landmark, i) => {
              const placed = placedLandmarks.find(p => p.landmarkDefId === landmark.id)
              const isSelected = selectedLandmarkId === landmark.id
              const color = COLORS[i % COLORS.length]

              return (
                <div
                  key={landmark.id}
                  onClick={() => {
                    setSelectedLandmarkId(isSelected ? null : landmark.id)
                    setActiveTool('point')
                  }}
                  className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer border-l-2 ${
                    isSelected
                      ? 'bg-[#1e1e36] border-cyan-400'
                      : 'border-transparent hover:bg-[#1a1a30]'
                  }`}
                >
                  {/* Color indicator */}
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{
                    backgroundColor: placed ? color : 'transparent',
                    border: `2px solid ${color}`,
                    opacity: placed ? 1 : 0.4,
                  }} />

                  {/* Label name */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs truncate ${placed ? 'text-gray-200' : 'text-gray-500'}`}>
                      {landmark.display_name}
                    </div>
                    {placed && (
                      <div className="text-[10px] text-gray-600 font-mono">
                        {Math.round(placed.w)}x{Math.round(placed.h)}
                      </div>
                    )}
                  </div>

                  {/* Status / delete */}
                  {placed ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteLandmark(landmark.id) }}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs"
                      title="Remove"
                    >
                      &times;
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-600">
                      {isSelected ? 'click image' : ''}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Info footer */}
          <div className="px-3 py-2 border-t border-[#2a2a4a] text-[10px] text-gray-600">
            {activeTool === 'point' && selectedLandmarkId
              ? 'Click on the image to place the landmark'
              : 'Select a label, then click the image'}
          </div>
        </div>
      </div>
    </div>
  )
}
