import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { getMyStats } from '../../api/annotations'
import { listImages } from '../../api/images'
import api from '../../api/client'

const LEVEL_NAMES = ['Novice', 'Observer', 'Student', 'Learner', 'Skilled', 'Advanced', 'Expert', 'Master', 'Elite', 'Legend']
const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1800, 2500, 3500, 5000]
const RING_COLORS = ['#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c']

function xpProgress(level: number, xp: number) {
  const s = LEVEL_THRESHOLDS[Math.min(level - 1, LEVEL_THRESHOLDS.length - 1)] || 0
  const e = LEVEL_THRESHOLDS[Math.min(level, LEVEL_THRESHOLDS.length - 1)] || 99999
  return { pct: e > s ? ((xp - s) / (e - s)) * 100 : 100, remaining: e - xp }
}

// Apple Fitness-style ring
function Ring({ pct, color, size = 120, stroke = 10, children }: {
  pct: number; color: string; size?: number; stroke?: number; children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(pct, 100) / 100) * circ
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} opacity={0.15} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

interface LBUser {
  id: string; full_name: string; year_level: string | null
  xp_points: number; level: number; accuracy_score: number | null
  total_images_labeled: number; streak_days: number
}

export function LabelingDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: stats } = useQuery({ queryKey: ['my-stats'], queryFn: getMyStats })
  const { data: imagesData } = useQuery({ queryKey: ['images-count'], queryFn: () => listImages({ limit: 1 }) })
  const { data: leaderboard } = useQuery<LBUser[]>({
    queryKey: ['leaderboard'],
    queryFn: async () => (await api.get('/accuracy/leaderboard?sort_by=xp')).data,
  })

  if (!user) return null

  const { pct, remaining } = xpProgress(user.level, user.xp_points)
  const lvlName = LEVEL_NAMES[Math.min(user.level - 1, LEVEL_NAMES.length - 1)]
  const ringColor = RING_COLORS[user.level % RING_COLORS.length]
  const myRank = leaderboard?.findIndex(u => u.id === user.id) ?? -1
  const accPct = stats?.accuracy_score != null ? Math.round(stats.accuracy_score * 100) : null

  return (
    <div className="max-w-3xl mx-auto px-4 py-2">
      {/* ── Profile + Ring ── */}
      <div className="flex items-center gap-8 mb-10">
        <Ring pct={pct} color={ringColor} size={130} stroke={10}>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-gray-900">{user.level}</div>
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{lvlName}</div>
          </div>
        </Ring>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{user.full_name}</h2>
          <p className="text-sm text-gray-400 mb-3">
            {user.year_level?.replace(/_/g, ' ')}{user.institution ? ` · ${user.institution}` : ''}
          </p>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-sm font-bold text-gray-700">{user.xp_points} XP</span>
            <span className="text-xs text-gray-400">· {remaining} to level {user.level + 1}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, pct)}%`, backgroundColor: ringColor }} />
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {[
          { value: user.total_images_labeled, label: 'Images', sub: 'labeled' },
          { value: user.streak_days, label: 'Day', sub: 'streak' },
          { value: accPct !== null ? `${accPct}%` : '—', label: 'Accuracy', sub: 'R-score' },
          { value: myRank >= 0 ? `#${myRank + 1}` : '—', label: 'Rank', sub: 'overall' },
        ].map((s, i) => (
          <div key={i} className="text-center py-4 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="text-2xl font-extrabold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Play button ── */}
      <button
        onClick={() => navigate('/labeling/annotate')}
        className="w-full mb-10 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl p-6 flex items-center justify-between transition-colors shadow-sm"
      >
        <div>
          <div className="text-lg font-bold">Start labeling</div>
          <div className="text-sm text-gray-400 mt-0.5">{imagesData?.total ?? '—'} images in the pool</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-semibold text-emerald-400">+10 XP</div>
            {user.streak_days > 0 && <div className="text-xs text-gray-500">+5 streak</div>}
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg">
            &#x25B6;
          </div>
        </div>
      </button>

      {/* ── Leaderboard ── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Leaderboard</h3>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {leaderboard && leaderboard.length > 0 ? leaderboard.slice(0, 10).map((entry, i) => {
            const isMe = entry.id === user.id
            const entryColor = RING_COLORS[entry.level % RING_COLORS.length]
            return (
              <div key={entry.id} className={`flex items-center gap-3 px-5 py-3 ${isMe ? 'bg-gray-50' : ''}`}>
                <div className="w-6 text-center text-sm font-bold text-gray-300">{i + 1}</div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: entryColor }}>
                  {entry.level}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${isMe ? 'text-gray-900' : 'text-gray-700'}`}>
                    {entry.full_name}{isMe ? ' (you)' : ''}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {LEVEL_NAMES[Math.min(entry.level - 1, LEVEL_NAMES.length - 1)]}
                    {entry.year_level ? ` · ${entry.year_level.replace(/_/g, ' ')}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-800">{entry.xp_points}</div>
                  <div className="text-[11px] text-gray-400">{entry.total_images_labeled} imgs</div>
                </div>
              </div>
            )
          }) : (
            <div className="p-10 text-center text-sm text-gray-400">No scores yet</div>
          )}
        </div>
      </div>

      {/* ── Info ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">How it works</h4>
          <ol className="text-sm text-gray-500 space-y-2">
            <li>1. Pick a landmark label</li>
            <li>2. Draw a box around it on the X-ray</li>
            <li>3. Label all landmarks, then submit</li>
            <li>4. See how others labeled the same image</li>
          </ol>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">XP rewards</h4>
          <div className="text-sm text-gray-500 space-y-2">
            <div className="flex justify-between">
              <span>Per image</span>
              <span className="font-semibold text-gray-700">+10 XP</span>
            </div>
            <div className="flex justify-between">
              <span>Streak bonus</span>
              <span className="font-semibold text-gray-700">+5 XP</span>
            </div>
            <div className="flex justify-between">
              <span>High accuracy</span>
              <span className="font-semibold text-emerald-600">More weight</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
