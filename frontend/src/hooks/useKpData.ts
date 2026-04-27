import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
export function useKpData() {
  return useQuery({
    queryKey: ['kp-index'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:3000/api/solar/kp').catch(() => ({ data: { current: 0, history48h: [] } }));
      return res.data;
    },
    refetchInterval: 60_000,
  });
}
