import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
export function useCmeData() {
  return useQuery({
    queryKey: ['cme'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:3000/api/solar/cme').catch(() => ({ data: { arrivalTime: null, speed: 0, isEarthDirected: false, type: 'None', source: 'N/A', confidence: 'LOW', window: 'N/A' } }));
      return res.data;
    },
    refetchInterval: 60 * 60_000,
  });
}
