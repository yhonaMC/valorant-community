import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiRequestError } from '../../api/client';
import { setSession } from '../../api/queries';
import type { Category, MapResults } from '../../api/types';

// Opción de un selector, igual para agentes y armas. `detail` es el rol o la categoría de tienda.
export type Option = { id: string; name: string; detail: string; icon: string; portrait?: string };

// Una mutación por categoría: guardar el agente no bloquea el arma.
export function useVote(mapId: string, category: Category, onSaved: (optionId: string) => void) {
  const queryClient = useQueryClient();
  const key = ['results', mapId];

  return useMutation({
    mutationFn: (optionId: string) => api<MapResults>(`/maps/${mapId}/votes/${category}`, 'PUT', { optionId }),
    // Voto registrado antes de este envío: el mensaje de error lo nombra.
    onMutate: () => ({ before: queryClient.getQueryData<MapResults>(key)?.myVotes?.[category] ?? null }),
    onSuccess: (data, optionId) => {
      // Solo se sustituye esta categoría: si el otro voto se guardó a la vez, su respuesta
      // puede llegar en otro orden y no debe pisarse con datos anteriores.
      const other: Category = category === 'agent' ? 'weapon' : 'agent';
      queryClient.setQueryData<MapResults>(key, (old) =>
        old
          ? {
              ...old,
              [category]: data[category],
              myVotes: data.myVotes && {
                ...data.myVotes,
                [other]: old.myVotes ? old.myVotes[other] : data.myVotes[other],
              },
            }
          : data,
      );
      onSaved(optionId);
    },
    onError: (e) => {
      // Sesión caducada: la cabecera y «Tu voto» pasan a modo visitante.
      if (e instanceof ApiRequestError && e.statusCode === 401) setSession(queryClient, null);
    },
  });
}

export type Vote = ReturnType<typeof useVote>;
