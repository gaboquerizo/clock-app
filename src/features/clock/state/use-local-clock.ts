/*—————————— Library ——————————*/
import { createSignal, onCleanup, onMount } from 'solid-js';
/*—————————— Functions ——————————*/
import { formatLocalClockTime } from '../../../core/time/clock';

const localClockUpdateInterval = 1000;

export function useLocalClock() {
  const [localTime, setLocalTime] = createSignal(
    formatLocalClockTime(Date.now()),
  );
  let intervalId: number | undefined;

  onMount(() => {
    const updateLocalTime = () => {
      setLocalTime(formatLocalClockTime(Date.now()));
    };

    updateLocalTime();
    intervalId = window.setInterval(
      updateLocalTime,
      localClockUpdateInterval,
    );
  });

  onCleanup(() => {
    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
    }
  });

  return localTime;
}
