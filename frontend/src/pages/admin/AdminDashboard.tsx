import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listImages } from '../../api/images'

export function AdminDashboard() {
  const { data } = useQuery({
    queryKey: ['images'],
    queryFn: () => listImages({ limit: 200 }),
  })

  const total = data?.total ?? 0
  const gtCount = data?.images.filter(i => i.is_expert_ground_truth).length ?? 0

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-3xl font-bold text-gray-900">{total}</div>
          <div className="text-sm text-gray-500">Total Images</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-3xl font-bold text-gray-900">{gtCount}</div>
          <div className="text-sm text-gray-500">Ground Truth Images</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-3xl font-bold text-gray-900">{total - gtCount}</div>
          <div className="text-sm text-gray-500">Labeling Pool</div>
        </div>
      </div>

      <div className="flex gap-4">
        <Link
          to="/admin/upload"
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
        >
          Upload Images
        </Link>
        <Link
          to="/admin/accuracy"
          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md hover:bg-gray-50"
        >
          Student Accuracy
        </Link>
      </div>

      {data && data.images.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Images</h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Filename</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Region</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Size</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Ground Truth</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {data.images.slice(0, 20).map((img) => (
                  <tr key={img.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{img.filename}</td>
                    <td className="px-4 py-2 text-gray-600">{img.body_region || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{img.width}x{img.height}</td>
                    <td className="px-4 py-2">{img.is_expert_ground_truth ? 'Yes' : '—'}</td>
                    <td className="px-4 py-2">
                      <Link to={`/admin/heatmap/${img.id}`} className="text-blue-600 hover:underline text-xs">
                        Heatmap
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
