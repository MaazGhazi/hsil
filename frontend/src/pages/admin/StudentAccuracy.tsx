import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import type { User } from '../../api/auth'

export function StudentAccuracy() {
  const queryClient = useQueryClient()

  const { data: students, isLoading } = useQuery<User[]>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data } = await api.get('/accuracy/leaderboard')
      return data
    },
  })

  const recompute = useMutation({
    mutationFn: () => api.post('/accuracy/recompute'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
  })

  if (isLoading) {
    return <div className="text-gray-500">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Student Accuracy</h2>
        <button
          onClick={() => recompute.mutate()}
          disabled={recompute.isPending}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50"
        >
          {recompute.isPending ? 'Recomputing...' : 'Recompute All'}
        </button>
      </div>

      {students && students.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Rank</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Role</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id} className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">#{i + 1}</td>
                  <td className="px-4 py-2 text-gray-900 font-medium">{s.full_name}</td>
                  <td className="px-4 py-2 text-gray-600">{s.email}</td>
                  <td className="px-4 py-2 text-gray-600">{s.role}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`font-mono font-semibold ${
                      (s.accuracy_score ?? 0) >= 0.75 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {s.accuracy_score !== null ? `${Math.round(s.accuracy_score * 100)}%` : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No accuracy data yet. Students need to label ground truth images first.</p>
      )}
    </div>
  )
}
