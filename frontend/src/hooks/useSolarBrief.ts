import { useState, useCallback, useEffect } from 'react';
export function useSolarBrief(score: number) {
  const [brief, setBrief] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const fetchBrief = useCallback(async () => {
    setIsStreaming(true);
    setBrief('');
    try {
      const response = await fetch('http://localhost:3000/api/solar/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
      });
      if (!response.ok) throw new Error();
      if(response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            setBrief(prev => prev + decoder.decode(value));
          }
      }
    } catch(e) {
      setBrief("Brief unavailable. Awaiting next cycle.");
    } finally {
      setIsStreaming(false);
    }
  }, [score]);

  useEffect(() => {
    if (score > 0) fetchBrief();
    const interval = setInterval(fetchBrief, 3 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchBrief, score]);

  return { brief, isStreaming };
}
