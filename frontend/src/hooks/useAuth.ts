import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMe, isLoggedIn, type User } from '../api/auth'

export function useAuth() {
  const queryClient = useQueryClient()

  const { data: user, isLoading, refetch } = useQuery<User>({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: isLoggedIn(),
    retry: false,
    staleTime: 1000 * 60 * 5,
  })

  const invalidate = async () => {
    // After login, the token is now in localStorage — refetch directly
    if (isLoggedIn()) {
      await refetch()
    } else {
      queryClient.removeQueries({ queryKey: ['me'] })
    }
  }

  return { user: user ?? null, isLoading, isLoggedIn: !!user, invalidate }
}
