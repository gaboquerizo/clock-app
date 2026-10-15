import { For, onMount, Show } from 'solid-js';

import './alarms-view.css';

import type { Alarm } from '../domain/alarm.types';
import AlarmCard from '../components/alarm-card';
import { createAlarmsState } from '../state/alarms-state';
import AppIcon from '../../../shared/ui/ui-icon/ui-icon';
import UiEmptyState from '../../../shared/ui/ui-empty-state/ui-empty-state';

function AddAlarmButton() {
  return (
    <button class="alarms-view__add-button" type="button">
      <AppIcon class="alarms-view__add-icon" name="proicons:add" />
      <span>Añadir Alarma</span>
    </button>
  );
}

function AlarmList(props: { alarms: Alarm[] }) {
  return (
    <ul aria-label="Alarmas configuradas" class="alarms-view__list">
      <For each={props.alarms}>
        {(alarm) => (
          <li class="alarms-view__list-item">
            <AlarmCard alarm={alarm} />
          </li>
        )}
      </For>
    </ul>
  );
}

export default function AlarmsView() {
  const alarms = createAlarmsState();

  onMount(() => {
    void alarms.actions.load();
  });

  return (
    <section aria-labelledby="alarms-view-title" class="alarms-view">
      <header class="alarms-view__header">
        <h1 class="alarms-view__title" id="alarms-view-title">
          Alarma
        </h1>
      </header>

      <div class="alarms-view__content">
        <Show
          when={alarms.state.status === 'ready'}
          fallback={
            <Show
              when={alarms.state.status === 'error'}
              fallback={
                <p aria-live="polite" class="alarms-view__message">
                  Cargando alarmas...
                </p>
              }
            >
              <p aria-live="assertive" class="alarms-view__message" role="alert">
                No se pudieron cargar las alarmas.
              </p>
            </Show>
          }
        >
          <Show
            when={alarms.state.alarms.length > 0}
            fallback={
              <UiEmptyState
                description={'Crea tu primera alarma con el botón “Añadir Alarma”'}
                icon="proicons:alarm-clock"
                title="No tienes alarmas todavía."
              >
                <AddAlarmButton />
              </UiEmptyState>
            }
          >
            <AlarmList alarms={alarms.state.alarms} />
          </Show>
        </Show>
      </div>
    </section>
  );
}
