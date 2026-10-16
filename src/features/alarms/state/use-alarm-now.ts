import { createSignal, onCleanup, onMount } from 'solid-js';

const alarmCountdownUpdateInterval = 1000;

/**
 * Provides a reactive timestamp for visual countdown refreshes.
 * Each update reads the device clock again instead of incrementing a counter.
 */
export function useAlarmNow() {
  const [now, setNow] = createSignal(Date.now());
  let intervalId: number | undefined;

  onMount(() => {
    const updateNow = () => {
      setNow(Date.now());
    };

    updateNow();
    intervalId = window.setInterval(updateNow, alarmCountdownUpdateInterval);
  });

  onCleanup(() => {
    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
    }
  });

  return now;
}
