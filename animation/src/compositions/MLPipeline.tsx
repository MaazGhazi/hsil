import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from 'remotion'
import { StudentLabeling } from '../sequences/StudentLabeling'
import { QualityFiltering } from '../sequences/QualityFiltering'
import { ModelTraining } from '../sequences/ModelTraining'
import { SurgeonOverlay } from '../sequences/SurgeonOverlay'

const SCENE = 270 // 9s each
const OVERLAP = 30 // 1s crossfade

export const MLPipeline: React.FC = () => {
  const frame = useCurrentFrame()

  // Floating particles — ambient depth layer
  const particles = Array.from({ length: 60 }, (_, i) => {
    const seed = i * 137.508 // golden angle
    const baseX = (seed * 7.3) % 1920
    const baseY = (seed * 4.1) % 1080
    const speed = 0.2 + (i % 5) * 0.15
    const size = 1 + (i % 3) * 0.8
    const drift = Math.sin(i * 0.7) * 80
    const x = baseX + Math.sin(frame * 0.008 + seed) * drift
    const y = (baseY + frame * speed) % 1120 - 20
    const op = 0.06 + 0.04 * Math.sin(frame * 0.02 + i)
    return { x, y, size, op }
  })

  // Scene-aware accent color for the ambient glow
  const glowR = interpolate(frame, [0, SCENE, SCENE * 2, SCENE * 3, 1200], [34, 34, 139, 245, 245])
  const glowG = interpolate(frame, [0, SCENE, SCENE * 2, SCENE * 3, 1200], [211, 197, 92, 158, 158])
  const glowB = interpolate(frame, [0, SCENE, SCENE * 2, SCENE * 3, 1200], [238, 94, 246, 11, 11])

  return (
    <AbsoluteFill style={{ backgroundColor: '#030712' }}>
      {/* Drifting particles */}
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        {particles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.size} fill="#94a3b8" opacity={p.op} />
        ))}
      </svg>

      {/* Moving radial glow that follows scene color */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 1400,
          height: 1400,
          transform: `translate(-50%, -50%) translate(${Math.sin(frame * 0.005) * 100}px, ${Math.cos(frame * 0.004) * 60}px)`,
          background: `radial-gradient(circle, rgba(${glowR},${glowG},${glowB},0.07) 0%, transparent 60%)`,
        }}
      />

      {/* Scene 1 */}
      <Sequence from={0} durationInFrames={SCENE + OVERLAP}>
        <Fade frame={frame} start={0} dur={SCENE} fade={OVERLAP}>
          <StudentLabeling />
        </Fade>
      </Sequence>

      {/* Scene 2 */}
      <Sequence from={SCENE - OVERLAP} durationInFrames={SCENE + OVERLAP * 2}>
        <Fade frame={frame} start={SCENE - OVERLAP} dur={SCENE} fade={OVERLAP}>
          <QualityFiltering />
        </Fade>
      </Sequence>

      {/* Scene 3 */}
      <Sequence from={SCENE * 2 - OVERLAP * 2} durationInFrames={SCENE + OVERLAP * 2}>
        <Fade frame={frame} start={SCENE * 2 - OVERLAP * 2} dur={SCENE} fade={OVERLAP}>
          <ModelTraining />
        </Fade>
      </Sequence>

      {/* Scene 4 */}
      <Sequence from={SCENE * 3 - OVERLAP * 3} durationInFrames={SCENE + OVERLAP * 2}>
        <Fade frame={frame} start={SCENE * 3 - OVERLAP * 3} dur={SCENE} fade={OVERLAP}>
          <SurgeonOverlay />
        </Fade>
      </Sequence>

      {/* Thin progress line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 2,
          background: `linear-gradient(90deg, rgb(${glowR},${glowG},${glowB}), transparent)`,
          width: `${(frame / 1200) * 100}%`,
        }}
      />
    </AbsoluteFill>
  )
}

const Fade: React.FC<{
  frame: number
  start: number
  dur: number
  fade: number
  children: React.ReactNode
}> = ({ frame, start, dur, fade, children }) => {
  const inOp = interpolate(frame, [start, start + fade], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const outOp = interpolate(frame, [start + dur - fade, start + dur], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const scale = interpolate(frame, [start, start + fade], [1.02, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(inOp, outOp),
        transform: `scale(${scale})`,
      }}
    >
      {children}
    </AbsoluteFill>
  )
}
