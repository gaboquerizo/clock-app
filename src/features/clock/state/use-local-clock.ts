/*—————————— Library ——————————*/
import { createSignal, onCleanup, onMount } from 'solid-js';

/*—————————— Functions ——————————*/
import {
  formatLocalClockDate,
  formatLocalClockTime,
  formatLocalDateTimeAttribute,
} from '../../../core/time/clock';
import {
  formatLocalGmtOffset,
  getDeviceTimeZone,
} from '../../../core/time/time-zone';

const localClockUpdateInterval = 1000;

type LocalClockState = {
  date: string;
  dateTime: string;
  gmtOffset: string;
  time: string;
  timeZone: string;
};

function getLocalClockState(timestamp: number): LocalClockState {
  return {
    date: formatLocalClockDate(timestamp),
    dateTime: formatLocalDateTimeAttribute(timestamp),
    gmtOffset: formatLocalGmtOffset(timestamp),
    time: formatLocalClockTime(timestamp),
    timeZone: getDeviceTimeZone(),
  };
}

export function useLocalClock() {
  const [localClock, setLocalClock] = createSignal(
    getLocalClockState(Date.now()),
  );
  let intervalId: number | undefined;

  onMount(() => {
    const updateLocalClock = () => {
      const timestamp = Date.now();

      setLocalClock(getLocalClockState(timestamp));
    };

    updateLocalClock();
    intervalId = window.setInterval(updateLocalClock, localClockUpdateInterval);
  });

  onCleanup(() => {
    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
    }
  });

  return localClock;
}
