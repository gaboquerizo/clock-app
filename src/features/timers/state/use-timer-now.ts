import { createSignal, onCleanup, onMount } from 'solid-js';

const timerCountdownUpdateInterval = 1_000;

/**
 * Provides a reactive timestamp for countdown presentation updates.
 * Each refresh reads the device clock instead of accumulating interval ticks.
 */
export function useTimerNow() {
  const [now, setNow] = createSignal(Date.now());
  let intervalId: number | undefined;

  onMount(() => {
    const updateNow = () => setNow(Date.now());

    updateNow();
    intervalId = window.setInterval(updateNow, timerCountdownUpdateInterval);
  });

  onCleanup(() => {
    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
    }
  });

  return now;
}
