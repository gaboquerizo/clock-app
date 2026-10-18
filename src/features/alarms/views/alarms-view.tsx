import { createSignal, For, Show } from 'solid-js';

import './alarms-view.css';

import type { Alarm } from '../domain/alarm.types';
import AlarmCard from '../components/alarm-card/alarm-card';
import AlarmDialog, {
  type AlarmDialogError,
  type AlarmDialogMode,
  type AlarmDialogValue,
} from '../components/alarm-dialog/alarm-dialog';
import { useAlarmsState } from '../state/alarms-context';
import type { AlarmsStateError } from '../state/alarms-state';
import { useAlarmNow } from '../state/use-alarm-now';
import AppIcon from '../../../shared/ui/ui-icon/ui-icon';
import UiEmptyState from '../../../shared/ui/ui-empty-state/ui-empty-state';
import NotificationPermissionNotice from '../components/notification-permission-notice/notification-permission-notice';

type AddAlarmButtonProps = {
  onClick: () => void;
};

function AddAlarmButton(props: AddAlarmButtonProps) {
  return (
    <button class="alarms-view__add-button" type="button" onClick={props.onClick}>
      <AppIcon class="alarms-view__add-icon" name="proicons:add" />
      <span>Añadir Alarma</span>
    </button>
  );
}

function getDialogError(error: AlarmsStateError): AlarmDialogError {
  switch (error.code) {
    case 'duplicate-time':
    case 'conflict':
      return { message: 'Ya existe una alarma configurada para esa hora.' };
    case 'invalid-time':
      return { message: 'Selecciona una hora válida.' };
    case 'invalid-label':
      return { message: 'La etiqueta no es válida.' };
    case 'not-found':
      return { message: 'La alarma ya no está disponible.' };
    default:
      return { message: 'No se pudo guardar la alarma.' };
  }
}

function AlarmList(props: {
  alarms: Alarm[];
  isToggling: (alarmId: string) => boolean;
  now: number;
  onEdit: (alarm: Alarm) => void;
  onToggle: (alarm: Alarm) => void;
}) {
  return (
    <ul aria-label="Alarmas configuradas" class="alarms-view__list">
      <For each={props.alarms}>
        {(alarm) => (
          <li class="alarms-view__list-item">
            <AlarmCard
              alarm={alarm}
              now={props.now}
              onEdit={() => props.onEdit(alarm)}
              onToggle={() => props.onToggle(alarm)}
              toggleBusy={props.isToggling(alarm.id)}
            />
          </li>
        )}
      </For>
    </ul>
  );
}

export default function AlarmsView() {
  const alarms = useAlarmsState();
  const now = useAlarmNow();
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [dialogMode, setDialogMode] = createSignal<AlarmDialogMode>('create');
  const [selectedAlarmId, setSelectedAlarmId] = createSignal<string | undefined>(
    undefined,
  );
  const [dialogError, setDialogError] = createSignal<AlarmDialogError | undefined>(
    undefined,
  );
  const [toggleError, setToggleError] = createSignal<string | undefined>(undefined);
  const [togglingAlarmIds, setTogglingAlarmIds] = createSignal<Set<string>>(
    new Set(),
  );

  const selectedAlarm = () =>
    alarms.state.alarms.find((alarm) => alarm.id === selectedAlarmId());
  const isLoading = () =>
    alarms.state.status === 'idle' || alarms.state.status === 'loading';
  const hasLoadError = () =>
    alarms.state.status === 'error' &&
    dialogError() === undefined &&
    toggleError() === undefined;

  const isToggling = (alarmId: string) => togglingAlarmIds().has(alarmId);
  const setToggling = (alarmId: string, pending: boolean) => {
    setTogglingAlarmIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (pending) {
        nextIds.add(alarmId);
      } else {
        nextIds.delete(alarmId);
      }

      return nextIds;
    });
  };

  const clearToggleError = () => {
    const hadToggleError = toggleError() !== undefined;
    setToggleError(undefined);

    if (hadToggleError && alarms.state.status === 'error') {
      alarms.actions.clearError();
    }
  };

  const openCreateDialog = () => {
    setSelectedAlarmId(undefined);
    setDialogMode('create');
    setDialogError(undefined);
    clearToggleError();
    setDialogOpen(true);
  };

  const openEditDialog = (alarm: Alarm) => {
    setSelectedAlarmId(alarm.id);
    setDialogMode('edit');
    setDialogError(undefined);
    clearToggleError();
    setDialogOpen(true);
  };

  const clearDialogError = () => {
    const hadDialogError = dialogError() !== undefined;
    setDialogError(undefined);

    if (hadDialogError && alarms.state.status === 'error') {
      alarms.actions.clearError();
    }
  };

  const closeDialog = () => {
    clearDialogError();
    setDialogOpen(false);
    setSelectedAlarmId(undefined);
  };

  const handleDialogSubmit = async (value: AlarmDialogValue) => {
    setDialogError(undefined);

    const alarmId = selectedAlarmId();
    const result =
      alarmId === undefined
        ? await alarms.actions.create(value)
        : await alarms.actions.update(alarmId, value);

    if (!result.ok) {
      setDialogError(getDialogError(result.error));
      return;
    }

    closeDialog();
  };

  const handleDialogDelete = async (alarmId: string) => {
    setDialogError(undefined);

    const result = await alarms.actions.remove(alarmId);

    if (!result.ok) {
      setDialogError({
        message:
          result.error.code === 'not-found'
            ? 'La alarma ya no está disponible.'
            : 'No se pudo eliminar la alarma.',
      });
      return;
    }

    closeDialog();
  };

  const handleToggle = async (alarm: Alarm) => {
    if (isToggling(alarm.id)) {
      return;
    }

    setToggleError(undefined);
    setToggling(alarm.id, true);

    try {
      const result = alarm.enabled
        ? await alarms.actions.disable(alarm.id)
        : await alarms.actions.enable(alarm.id);

      if (!result.ok) {
        setToggleError(
          result.error.code === 'not-found'
            ? 'La alarma ya no está disponible.'
            : 'No se pudo actualizar el estado de la alarma.',
        );
      }
    } finally {
      setToggling(alarm.id, false);
    }
  };

  return (
    <section aria-labelledby="alarms-view-title" class="alarms-view">
      <header class="alarms-view__header">
        <h1 class="alarms-view__title" id="alarms-view-title">
          Alarma
        </h1>
        <AddAlarmButton onClick={openCreateDialog} />
      </header>

      <div class="alarms-view__content">
        <NotificationPermissionNotice />

        <Show when={toggleError() !== undefined}>
          <p aria-live="assertive" class="alarms-view__message" role="alert">
            {toggleError()}
          </p>
        </Show>

        <div class="alarms-view__content-body">
          <Show
            when={!isLoading() && !hasLoadError()}
            fallback={
              <Show
                when={hasLoadError()}
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
                  description="Crea tu primera alarma con el botón «Añadir Alarma»"
                  icon="proicons:alarm-clock"
                  title="No tienes alarmas todavía."
                >
                  <AddAlarmButton onClick={openCreateDialog} />
                </UiEmptyState>
              }
            >
              <AlarmList
                alarms={alarms.state.alarms}
                isToggling={isToggling}
                now={now()}
                onEdit={openEditDialog}
                onToggle={handleToggle}
              />
            </Show>
          </Show>
        </div>
      </div>

      <AlarmDialog
        alarm={selectedAlarm()}
        busy={alarms.state.status === 'saving'}
        error={dialogError()}
        mode={dialogMode()}
        onClearError={clearDialogError}
        onClose={closeDialog}
        onConfirmDelete={handleDialogDelete}
        onSubmit={handleDialogSubmit}
        open={dialogOpen()}
      />
    </section>
  );
}
