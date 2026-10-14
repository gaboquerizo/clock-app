import './alarms-view.css';

import AppIcon from '../../../shared/ui/ui-icon/ui-icon';

export default function AlarmsView() {
  return (
    <section aria-labelledby="alarms-view-title" class="alarms-view">
      <header class="alarms-view__header">
        <h1 class="alarms-view__title" id="alarms-view-title">
          Alarma
        </h1>
      </header>

      <div class="alarms-view__content">
        <button class="alarms-view__add-button" type="button">
          <AppIcon class="alarms-view__add-icon" name="proicons:add" />
          <span>Añadir Alarma</span>
        </button>
      </div>
    </section>
  );
}
