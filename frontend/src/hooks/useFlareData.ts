import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
export function useFlareData() {
  return useQuery({
    queryKey: ['flares'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:3000/api/solar/flares').catch(() => ({ data: [] }));
      return res.data;
    },
    refetchInterval: 15 * 60_000,
  });
}
