import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api, ApiRequestError } from './client';
import type { Catalog, User } from './types';

// Sesión actual: 401 no es un error, es «sin sesión» (null).
export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        return await api<User>('/auth/me');
      } catch (e) {
        if (e instanceof ApiRequestError && e.statusCode === 401) return null;
        throw e;
      }
    },
    staleTime: Infinity,
    retry: false,
  });
}

// Tras login/registro/logout: fija la sesión y marca como obsoletos los resultados
// (llevan myVotes, que dependen del usuario). H5 debe usar la clave ['results', mapId].
export function setSession(queryClient: QueryClient, user: User | null) {
  queryClient.setQueryData(['session'], user);
  queryClient.invalidateQueries({ queryKey: ['results'] });
}

// El catálogo cambia con los parches del juego, no durante una visita: caché de 1 h.
export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: () => api<Catalog>('/catalog'),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
