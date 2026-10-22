import './timers-view.css';

import AppIcon from '@/shared/ui/ui-icon/ui-icon';

function AddTimerButton() {
  return (
    <button class="timers-view__add-button" type="button">
      <AppIcon class="timers-view__add-icon" name="proicons:add" />
      <span>Añadir temporizador</span>
    </button>
  );
}

export default function TimersView() {
  return (
    <section aria-labelledby="timers-view-title" class="timers-view">
      <header class="timers-view__header">
        <h1 class="timers-view__title" id="timers-view-title">
          Temporizador
        </h1>
        <AddTimerButton />
      </header>

      <div class="timers-view__content">
        <div class="timers-view__content-body" />
      </div>
    </section>
  );
}
