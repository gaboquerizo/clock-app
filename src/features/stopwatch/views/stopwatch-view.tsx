import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';

import { useStopwatchState } from '@/features/stopwatch/state/stopwatch-context';

import { formatStopwatchElapsed } from './stopwatch-view.utils';

import './stopwatch-view.css';

export default function StopwatchView() {
  const stopwatch = useStopwatchState();
  const [now, setNow] = createSignal(Date.now());
  const elapsedMs = createMemo(() => {
    const result = stopwatch.selectors.elapsedAt(now());
    return result.ok ? result.value : 0;
  });
  const elapsedText = createMemo(() =>
    formatStopwatchElapsed(elapsedMs()),
  );

  createEffect(() => {
    if (stopwatch.state.stopwatch.status !== 'running') {
      setNow(Date.now());
      return;
    }

    let animationFrameId: number;

    const updateTimestamp = () => {
      setNow(Date.now());
      animationFrameId = window.requestAnimationFrame(updateTimestamp);
    };

    updateTimestamp();

    onCleanup(() => {
      window.cancelAnimationFrame(animationFrameId);
    });
  });

  return (
    <section
      aria-labelledby="stopwatch-view-title"
      class="stopwatch-view"
    >
      <header class="stopwatch-view__header">
        <h1 class="stopwatch-view__title" id="stopwatch-view-title">
          Cronómetro
        </h1>
      </header>

      <div class="stopwatch-view__content">
        <section
          aria-labelledby="stopwatch-view-elapsed-title"
          class="stopwatch-view__region stopwatch-view__elapsed"
        >
          <h2
            class="stopwatch-view__region-title"
            id="stopwatch-view-elapsed-title"
          >
            Tiempo transcurrido
          </h2>
          <div
            aria-live="off"
            aria-labelledby="stopwatch-view-elapsed-title"
            class="stopwatch-view__elapsed-time"
            role="timer"
          >
            {elapsedText()}
          </div>
        </section>

        <section
          aria-labelledby="stopwatch-view-controls-title"
          class="stopwatch-view__region stopwatch-view__controls"
        >
          <h2
            class="stopwatch-view__region-title"
            id="stopwatch-view-controls-title"
          >
            Controles principales
          </h2>
        </section>

        <section
          aria-labelledby="stopwatch-view-laps-title"
          class="stopwatch-view__region stopwatch-view__laps"
        >
          <h2
            class="stopwatch-view__region-title"
            id="stopwatch-view-laps-title"
          >
            Registro de vueltas
          </h2>
          <div aria-hidden="true" class="stopwatch-view__laps-space" />
        </section>
      </div>
    </section>
  );
}
