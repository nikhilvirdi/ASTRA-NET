import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
export function useSolarRealtime() {
  return useQuery({
    queryKey: ['solar-realtime'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:3000/api/solar/realtime').catch(() => ({ data: { bz: 0, speed: 0, density: 0, temperature: 0, protonFlux: 0, xrayFlux: 0 } }));
      return res.data;
    },
    refetchInterval: 10_000,
  });
}
