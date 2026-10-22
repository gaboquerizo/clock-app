import './timers-view.css';

import AppIcon from '@/shared/ui/ui-icon/ui-icon';
import UiEmptyState from '@/shared/ui/ui-empty-state/ui-empty-state';

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
      </header>

      <div class="timers-view__content">
        <div class="timers-view__content-body">
          <UiEmptyState
            description="Crea tu primer temporizador con el botón «Añadir temporizador»."
            icon="proicons:timer"
            title="No tienes temporizadores todavía."
          >
            <AddTimerButton />
          </UiEmptyState>
        </div>
      </div>
    </section>
  );
}
