import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'

export const QualityFiltering: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // ----- Giant watermark -----
  const numOp = interpolate(frame, [0, 30], [0, 0.04], { extrapolateRight: 'clamp' })

  // ----- Center stage: two dot clusters converging -----
  // Student dots start scattered left, expert dots scattered right
  // They drift toward each other and pair up
  const pairs = [
    { label: 'Pedicle', sx: -220, sy: -80, ex: 220, ey: -90, fx: -12, fy: -80, gx: 12, gy: -80, dist: 8 },
    { label: 'SAP', sx: -200, sy: -20, ex: 240, ey: -10, fx: -12, fy: -20, gx: 12, gy: -15, dist: 11 },
    { label: 'Transverse L', sx: -260, sy: 30, ex: 190, ey: 40, fx: -12, fy: 35, gx: 12, gy: 30, dist: 22 },
    { label: 'Transverse R', sx: -180, sy: 80, ex: 260, ey: 70, fx: -12, fy: 75, gx: 12, gy: 80, dist: 6 },
    { label: 'Lamina', sx: -240, sy: 130, ex: 210, ey: 140, fx: -12, fy: 130, gx: 12, gy: 135, dist: 9 },
  ]

  // Phase 1 (0–80): dots scattered. Phase 2 (80–140): converge. Phase 3 (140+): paired with lines
  const converge = interpolate(frame, [60, 130], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Circular accuracy gauge
  const gaugeR = 120
  const gaugeCirc = 2 * Math.PI * gaugeR
  const accuracy = 91
  const gaugeFill = interpolate(frame, [150, 220], [0, accuracy / 100], { extrapolateRight: 'clamp' })
  const gaugeOp = interpolate(frame, [140, 160], [0, 1], { extrapolateRight: 'clamp' })
  const gaugeNum = Math.round(gaugeFill * 100)

  // Streaming data particles from left to right through the center
  const streams = Array.from({ length: 20 }, (_, i) => {
    const seed = i * 47.3
    const baseY = 540 + Math.sin(seed) * 300
    const speed = 1.5 + (i % 4) * 0.5
    const x = ((frame * speed + seed * 3) % 2200) - 140
    const y = baseY + Math.sin(frame * 0.03 + i) * 20
    const op = 0.08 + 0.04 * Math.sin(frame * 0.05 + i)
    return { x, y, op }
  })

  return (
    <AbsoluteFill>
      {/* Data stream particles */}
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        {streams.map((s, i) => (
          <g key={i} opacity={s.op}>
            <circle cx={s.x} cy={s.y} r={2} fill="#22c55e" />
            <line
              x1={s.x - 15}
              y1={s.y}
              x2={s.x}
              y2={s.y}
              stroke="#22c55e"
              strokeWidth={1}
              opacity={0.5}
            />
          </g>
        ))}
      </svg>

      {/* Giant "02" */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: numOp,
          fontSize: 600,
          fontWeight: 900,
          fontFamily: 'system-ui, sans-serif',
          color: '#22c55e',
          lineHeight: 1,
        }}
      >
        02
      </div>

      {/* Title — right aligned this time for variety */}
      <div style={{ position: 'absolute', top: 100, right: 100, textAlign: 'right' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          {'VALIDATE'.split('').map((ch, i) => (
            <span
              key={i}
              style={{
                color: '#22c55e',
                fontSize: 18,
                fontWeight: 700,
                fontFamily: 'system-ui, sans-serif',
                letterSpacing: 6,
                opacity: interpolate(frame, [5 + i * 3, 15 + i * 3], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
                transform: `translateY(${interpolate(frame, [5 + i * 3, 15 + i * 3], [15, 0], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })}px)`,
                display: 'inline-block',
              }}
            >
              {ch}
            </span>
          ))}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <h1
            style={{
              color: '#f1f5f9',
              fontSize: 64,
              fontWeight: 800,
              fontFamily: 'system-ui, sans-serif',
              lineHeight: 1.15,
              margin: 0,
              opacity: interpolate(frame, [12, 40], [0, 1], { extrapolateRight: 'clamp' }),
              transform: `translateY(${interpolate(frame, [12, 40], [60, 0], { extrapolateRight: 'clamp' })}px)`,
            }}
          >
            Measure against
          </h1>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <h1
            style={{
              color: '#22c55e',
              fontSize: 64,
              fontWeight: 800,
              fontFamily: 'system-ui, sans-serif',
              lineHeight: 1.15,
              margin: 0,
              opacity: interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp' }),
              transform: `translateY(${interpolate(frame, [20, 50], [60, 0], { extrapolateRight: 'clamp' })}px)`,
            }}
          >
            expert ground truth
          </h1>
        </div>
      </div>

      {/* Center: converging dot pairs */}
      <svg
        width={1920}
        height={1080}
        viewBox="-960 -540 1920 1080"
        style={{ position: 'absolute' }}
      >
        <defs>
          <filter id="glow2">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {pairs.map((p, i) => {
          // Student dot position (converges from left)
          const sX = p.sx + (p.fx - p.sx) * converge
          const sY = p.sy + (p.fy - p.sy) * converge
          // Expert dot position (converges from right)
          const eX = p.ex + (p.gx - p.ex) * converge
          const eY = p.ey + (p.gy - p.ey) * converge

          const lineOp = interpolate(frame, [130, 150], [0, 0.6], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })

          const pairAppear = spring({ frame: frame - 15 - i * 8, fps, config: { damping: 12, mass: 0.5 } })
          const vis = Math.max(0, pairAppear)

          const distColor = p.dist < 15 ? '#22c55e' : '#f59e0b'

          return (
            <g key={i} opacity={vis}>
              {/* Connection line (appears after convergence) */}
              {converge > 0.9 && (
                <line
                  x1={sX}
                  y1={sY}
                  x2={eX}
                  y2={eY}
                  stroke={distColor}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  opacity={lineOp}
                />
              )}
              {/* Student dot — cyan */}
              <circle cx={sX} cy={sY} r={7} fill="#22d3ee" opacity={0.8} filter="url(#glow2)" />
              <circle cx={sX} cy={sY} r={3} fill="#fff" />
              {/* Expert dot — green */}
              <circle cx={eX} cy={eY} r={7} fill="#22c55e" opacity={0.8} filter="url(#glow2)" />
              <circle cx={eX} cy={eY} r={3} fill="#fff" />
              {/* Distance badge */}
              {converge > 0.9 && (
                <text
                  x={(sX + eX) / 2}
                  y={(sY + eY) / 2 - 14}
                  textAnchor="middle"
                  fill={distColor}
                  fontSize={12}
                  fontFamily="ui-monospace, monospace"
                  fontWeight={700}
                  opacity={lineOp}
                >
                  {p.dist}px
                </text>
              )}
              {/* Label */}
              <text
                x={eX + 20}
                y={eY + 5}
                fill="#64748b"
                fontSize={13}
                fontFamily="system-ui, sans-serif"
                opacity={lineOp}
              >
                {p.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Bottom: circular accuracy gauge */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: gaugeOp,
          display: 'flex',
          alignItems: 'center',
          gap: 40,
        }}
      >
        <svg width={260} height={260} viewBox="-140 -140 280 280">
          {/* Track */}
          <circle
            r={gaugeR}
            fill="none"
            stroke="#1e293b"
            strokeWidth={8}
          />
          {/* Fill arc */}
          <circle
            r={gaugeR}
            fill="none"
            stroke="#22c55e"
            strokeWidth={8}
            strokeDasharray={gaugeCirc}
            strokeDashoffset={gaugeCirc * (1 - gaugeFill)}
            strokeLinecap="round"
            transform="rotate(-90)"
            filter="url(#glow2)"
          />
          {/* Center text */}
          <text
            x={0}
            y={12}
            textAnchor="middle"
            fill="#f1f5f9"
            fontSize={64}
            fontWeight={800}
            fontFamily="system-ui, sans-serif"
          >
            {gaugeNum}
          </text>
          <text
            x={0}
            y={42}
            textAnchor="middle"
            fill="#64748b"
            fontSize={16}
            fontFamily="system-ui, sans-serif"
          >
            % accuracy
          </text>
        </svg>

        <div>
          <div style={{ color: '#94a3b8', fontSize: 16, fontFamily: 'system-ui, sans-serif', marginBottom: 6 }}>
            Threshold: 15px per landmark
          </div>
          <div style={{ color: '#334155', fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>
            Only high-quality labels reach the model.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}
