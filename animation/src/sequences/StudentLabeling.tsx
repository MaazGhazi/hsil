import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'

// A more detailed vertebra (scottie dog oblique view) with multiple sub-paths
const SPINE_PATHS = [
  // Vertebral body
  'M -40,-80 C -20,-95 20,-95 40,-80 L 50,-20 C 30,0 -30,0 -50,-20 Z',
  // Transverse processes
  'M -50,-50 L -110,-40 L -105,-55 L -50,-55 Z',
  'M 50,-50 L 110,-40 L 105,-55 L 50,-55 Z',
  // Spinous process
  'M -8,-80 L 0,-130 L 8,-80',
  // Pedicle (eye of scottie dog)
  'M -5,-55 A 12 12 0 1 1 5,-55 A 12 12 0 1 1 -5,-55',
  // Lamina arcs
  'M -40,-75 Q -55,-60 -50,-40',
  'M 40,-75 Q 55,-60 50,-40',
]

export const StudentLabeling: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // ----- Big number that sits behind everything -----
  const numScale = interpolate(frame, [0, 40], [0.8, 1], { extrapolateRight: 'clamp' })
  const numOp = interpolate(frame, [0, 30], [0, 0.04], { extrapolateRight: 'clamp' })

  // ----- Spine draw-on (staggered per path) -----
  const drawStart = 20

  // ----- Landmarks with animated cursor -----
  const landmarks = [
    { cx: 0, cy: -55, label: 'Pedicle', delay: 60 },
    { cx: 0, cy: -130, label: 'Spinous Proc.', delay: 85 },
    { cx: -110, cy: -45, label: 'L. Transverse', delay: 110 },
    { cx: 110, cy: -45, label: 'R. Transverse', delay: 135 },
    { cx: -45, cy: -55, label: 'L. Lamina', delay: 155 },
    { cx: 45, cy: -55, label: 'R. Lamina', delay: 175 },
    { cx: 0, cy: -10, label: 'Inferior Body', delay: 195 },
  ]

  // Cursor follows landmarks
  const cursorLm = landmarks.reduce(
    (best, lm) => (frame >= lm.delay - 15 && lm.delay > best.delay ? lm : best),
    landmarks[0]
  )
  const cursorX = interpolate(
    frame,
    [cursorLm.delay - 15, cursorLm.delay],
    [cursorLm.cx + 40, cursorLm.cx],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )
  const cursorY = interpolate(
    frame,
    [cursorLm.delay - 15, cursorLm.delay],
    [cursorLm.cy + 30, cursorLm.cy],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )
  const cursorOp = frame > 45 && frame < 220 ? 0.7 : 0

  // ----- Title text -----
  const titleChars = 'LABEL'.split('')

  // Counter
  const count = Math.min(
    Math.floor(interpolate(frame, [180, 250], [0, 247], { extrapolateRight: 'clamp' })),
    247
  )

  return (
    <AbsoluteFill>
      {/* Giant "01" watermark */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${numScale})`,
          opacity: numOp,
          fontSize: 600,
          fontWeight: 900,
          fontFamily: 'system-ui, sans-serif',
          color: '#22d3ee',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        01
      </div>

      {/* Spine visualization — centered */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '55%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <svg width={700} height={500} viewBox="-160 -180 320 240">
          <defs>
            <filter id="glow1">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Draw-on spine paths */}
          {SPINE_PATHS.map((d, i) => {
            const segStart = drawStart + i * 8
            const progress = interpolate(frame, [segStart, segStart + 40], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            })
            return (
              <g key={i}>
                {/* Glow layer */}
                <path
                  d={d}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth={6}
                  strokeDasharray={500}
                  strokeDashoffset={500 * (1 - progress)}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.15 * progress}
                  filter="url(#glow1)"
                />
                {/* Crisp line */}
                <path
                  d={d}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  strokeDasharray={500}
                  strokeDashoffset={500 * (1 - progress)}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.6 * progress}
                />
              </g>
            )
          })}

          {/* Landmark placement with ripple effect */}
          {landmarks.map((lm, i) => {
            const s = spring({ frame: frame - lm.delay, fps, config: { damping: 10, mass: 0.4 } })
            const scale = Math.max(0, s)
            // Expanding ripple ring on click
            const rippleT = Math.max(0, frame - lm.delay) / 30
            const rippleR = rippleT * 40
            const rippleOp = Math.max(0, 1 - rippleT) * 0.5

            return (
              <g key={i} transform={`translate(${lm.cx}, ${lm.cy})`}>
                {/* Click ripple — expands and fades */}
                {frame > lm.delay && frame < lm.delay + 30 && (
                  <circle r={rippleR} fill="none" stroke="#22d3ee" strokeWidth={1.5} opacity={rippleOp} />
                )}
                {/* Persistent subtle halo */}
                <circle r={20 * scale} fill="#22d3ee" opacity={0.06 * scale} />
                {/* Outer ring */}
                <circle r={8 * scale} fill="none" stroke="#22d3ee" strokeWidth={1.5} opacity={0.5 * scale} />
                {/* Core */}
                <circle r={4 * scale} fill="#22d3ee" />
                <circle r={2 * scale} fill="#fff" />
                {/* Label with line */}
                <line
                  x1={9}
                  y1={0}
                  x2={28}
                  y2={0}
                  stroke="#22d3ee"
                  strokeWidth={0.5}
                  opacity={0.4 * scale}
                />
                <text
                  x={32}
                  y={4}
                  fill="#94a3b8"
                  fontSize={11}
                  fontFamily="system-ui, sans-serif"
                  fontWeight={500}
                  opacity={interpolate(frame, [lm.delay + 8, lm.delay + 20], [0, 0.8], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  })}
                >
                  {lm.label}
                </text>
              </g>
            )
          })}

          {/* Cursor */}
          <g
            transform={`translate(${cursorX}, ${cursorY})`}
            opacity={cursorOp}
          >
            <path
              d="M 0,0 L 0,18 L 5,14 L 9,22 L 12,20 L 8,13 L 14,11 Z"
              fill="#fff"
              opacity={0.9}
              transform="scale(0.9)"
            />
          </g>
        </svg>
      </div>

      {/* Left side text */}
      <div style={{ position: 'absolute', top: 120, left: 100 }}>
        {/* Staggered character reveal for "LABEL" */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {titleChars.map((ch, i) => {
            const charOp = interpolate(frame, [5 + i * 4, 15 + i * 4], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            })
            const charY = interpolate(frame, [5 + i * 4, 15 + i * 4], [20, 0], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            })
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  color: '#22d3ee',
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: 'system-ui, sans-serif',
                  letterSpacing: 6,
                  opacity: charOp,
                  transform: `translateY(${charY}px)`,
                }}
              >
                {ch}
              </span>
            )
          })}
        </div>

        {/* Main headline — words slide up staggered */}
        <div style={{ overflow: 'hidden' }}>
          <h1
            style={{
              color: '#f1f5f9',
              fontSize: 68,
              fontWeight: 800,
              fontFamily: 'system-ui, sans-serif',
              lineHeight: 1.1,
              margin: 0,
              transform: `translateY(${interpolate(frame, [10, 35], [80, 0], { extrapolateRight: 'clamp' })}px)`,
              opacity: interpolate(frame, [10, 35], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            Students place
          </h1>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <h1
            style={{
              color: '#f1f5f9',
              fontSize: 68,
              fontWeight: 800,
              fontFamily: 'system-ui, sans-serif',
              lineHeight: 1.1,
              margin: 0,
              transform: `translateY(${interpolate(frame, [18, 45], [80, 0], { extrapolateRight: 'clamp' })}px)`,
              opacity: interpolate(frame, [18, 45], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            landmarks on
          </h1>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <h1
            style={{
              color: '#22d3ee',
              fontSize: 68,
              fontWeight: 800,
              fontFamily: 'system-ui, sans-serif',
              lineHeight: 1.1,
              margin: 0,
              transform: `translateY(${interpolate(frame, [26, 55], [80, 0], { extrapolateRight: 'clamp' })}px)`,
              opacity: interpolate(frame, [26, 55], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            fluoroscopy scans
          </h1>
        </div>

        {/* Tagline */}
        <p
          style={{
            color: '#475569',
            fontSize: 22,
            fontFamily: 'system-ui, sans-serif',
            marginTop: 24,
            opacity: interpolate(frame, [50, 75], [0, 1], { extrapolateRight: 'clamp' }),
            transform: `translateY(${interpolate(frame, [50, 75], [10, 0], { extrapolateRight: 'clamp' })}px)`,
          }}
        >
          Every click builds the dataset that teaches AI to see.
        </p>
      </div>

      {/* Bottom counter — slides up */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'baseline',
          gap: 12,
          opacity: interpolate(frame, [200, 225], [0, 1], { extrapolateRight: 'clamp' }),
          transform: `translateY(${interpolate(frame, [200, 225], [30, 0], { extrapolateRight: 'clamp' })}px)`,
        }}
      >
        <span
          style={{
            color: '#22d3ee',
            fontSize: 80,
            fontWeight: 900,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {count}
        </span>
        <span
          style={{
            color: '#334155',
            fontSize: 28,
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 500,
          }}
        >
          images labeled and counting
        </span>
      </div>
    </AbsoluteFill>
  )
}
