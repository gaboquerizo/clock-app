import './stopwatch-view.css';

export default function StopwatchView() {
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
          <div aria-hidden="true" class="stopwatch-view__elapsed-space" />
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
