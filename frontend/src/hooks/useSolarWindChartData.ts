import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
export function useSolarWindChartData() {
  return useQuery({
    queryKey: ['solar-wind'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:3000/api/solar/wind').catch(() => ({ data: { history24h: [] } }));
      return res.data;
    },
    refetchInterval: 60_000,
  });
}
