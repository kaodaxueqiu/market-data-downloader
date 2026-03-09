import { useCallback, useEffect, useState } from "react";

export const useCountdown = (initial = 0, intervalMs = 1000) => {
  const [countdown, setCountdown] = useState(initial);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => {
      setCountdown((prevCountdown) => Math.max(prevCountdown - 1, 0));
    }, intervalMs);

    return () => clearTimeout(timer);
  }, [countdown, intervalMs]);

  const start = useCallback((seconds: number) => {
    setCountdown(seconds);
  }, []);

  const reset = useCallback(() => {
    setCountdown(0);
  }, []);

  return {
    countdown,
    isRunning: countdown > 0,
    start,
    reset,
  };
};
