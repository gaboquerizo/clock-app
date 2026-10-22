import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';

import '@/shared/styles/main.css';
import TimerDurationInput from '@/features/timers/components/timer-duration-input/timer-duration-input';

const root = document.querySelector('#test-root');

if (!(root instanceof HTMLElement)) {
  throw new Error('Timer duration fixture root is missing.');
}

render(() => {
  const [durationMs, setDurationMs] = createSignal<number | undefined>();

  return (
    <>
      <TimerDurationInput onValueChange={setDurationMs} />
      <output aria-live="polite" data-testid="duration-output">
        {durationMs() ?? 'invalid'}
      </output>
    </>
  );
}, root);
