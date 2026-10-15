/*—————————— Library ——————————*/
import {
  createEffect,
  createSignal,
  Match,
  Show,
  Switch,
} from 'solid-js';

/*—————————— Types ——————————*/
import type { Alarm } from '../../domain/alarm.types';

/*—————————— Components ——————————*/
import AlarmTimeInput from '../alarm-time-input/alarm-time-input';
import UiDialog from '../../../../shared/ui/ui-dialog/ui-dialog';
import AppIcon from '../../../../shared/ui/ui-icon/ui-icon';

/*—————————— Styles ——————————*/
import './alarm-dialog.css';

export type AlarmDialogMode = 'create' | 'edit' | 'confirm-delete';

export type AlarmDialogValue = {
  label: string;
  time: string;
};

export type AlarmDialogProps = {
  alarm?: Pick<Alarm, 'id' | 'label' | 'time'>;
  mode: AlarmDialogMode;
  onClose: () => void;
  onConfirmDelete?: (alarmId: string) => void;
  onSubmit?: (value: AlarmDialogValue) => void;
  open: boolean;
};

function getModeTitle(mode: AlarmDialogMode): string {
  if (mode === 'confirm-delete') {
    return 'Eliminar alarma';
  }

  return mode === 'edit' ? 'Editar alarma' : 'Añadir alarma';
}

function getModeIcon(mode: AlarmDialogMode) {
  return mode === 'confirm-delete' ? 'proicons:delete' : 'proicons:alarm-clock';
}

export default function AlarmDialog(props: AlarmDialogProps) {
  const [activeMode, setActiveMode] = createSignal<AlarmDialogMode>(props.mode);
  const [time, setTime] = createSignal('00:00');
  const [label, setLabel] = createSignal('');
  const [formInstance, setFormInstance] = createSignal(0);
  let previousExternalMode = props.mode;
  let previousFormKey = '';

  createEffect(() => {
    const isOpen = props.open;
    const externalMode = props.mode;
    const mode = activeMode();

    if (!isOpen) {
      setActiveMode(externalMode);
      previousExternalMode = externalMode;
      previousFormKey = '';
      return;
    }

    if (externalMode !== previousExternalMode) {
      previousExternalMode = externalMode;
      setActiveMode(externalMode);
    }

    const alarmId = props.alarm?.id ?? 'new';
    const initialTime = mode === 'edit' ? props.alarm?.time ?? '00:00' : '00:00';
    const initialLabel = mode === 'edit' ? props.alarm?.label ?? '' : '';
    const formKey = `${mode}:${alarmId}:${initialTime}:${initialLabel}`;

    if (formKey !== previousFormKey) {
      previousFormKey = formKey;
      setTime(initialTime);
      setLabel(initialLabel);
      setFormInstance((instance) => instance + 1);
    }
  });

  const submitForm = (event: SubmitEvent) => {
    event.preventDefault();

    if (activeMode() === 'confirm-delete') {
      return;
    }

    props.onSubmit?.({
      label: label().trim(),
      time: time(),
    });
  };

  const requestDeleteConfirmation = () => {
    if (activeMode() === 'edit' && props.alarm !== undefined) {
      setActiveMode('confirm-delete');
    }
  };

  const confirmDelete = () => {
    const alarmId = props.alarm?.id;

    if (alarmId !== undefined) {
      props.onConfirmDelete?.(alarmId);
    }
  };

  return (
    <UiDialog
      open={props.open}
      title={getModeTitle(activeMode())}
      onClose={props.onClose}
    >
      <div class="alarm-dialog">
        <div class="alarm-dialog__mode-icon" data-mode={activeMode()}>
          <AppIcon class="alarm-dialog__mode-icon-svg" name={getModeIcon(activeMode())} />
        </div>

        <Switch>
          <Match when={activeMode() === 'confirm-delete'}>
            <section aria-labelledby="alarm-dialog-delete-title" class="alarm-dialog__confirmation">
              <h3 class="alarm-dialog__confirmation-title" id="alarm-dialog-delete-title">
                ¿Eliminar esta alarma?
              </h3>
              <p class="alarm-dialog__confirmation-description">
                La alarma «{props.alarm?.label || 'Alarma'}» se eliminará cuando se confirme.
              </p>
              <div class="alarm-dialog__actions">
                <button
                  autofocus
                  class="alarm-dialog__button alarm-dialog__button--secondary"
                  type="button"
                  onClick={() => setActiveMode('edit')}
                >
                  Cancelar
                </button>
                <button
                  class="alarm-dialog__button alarm-dialog__button--danger"
                  disabled={props.alarm === undefined}
                  type="button"
                  onClick={confirmDelete}
                >
                  Eliminar
                </button>
              </div>
            </section>
          </Match>

          <Match when={activeMode() === 'create' || activeMode() === 'edit'}>
            <form class="alarm-dialog__form" onSubmit={submitForm}>
              <Show keyed when={formInstance()}>
                <AlarmTimeInput initialValue={time()} onChange={setTime} />
              </Show>

              <label class="alarm-dialog__label-field">
                <AppIcon class="alarm-dialog__label-icon" name="proicons:edit" />
                <span class="alarm-dialog__visually-hidden">Etiqueta</span>
                <input
                  aria-label="Etiqueta de la alarma"
                  class="alarm-dialog__label-input"
                  maxlength="100"
                  name="label"
                  placeholder="Nueva alarma"
                  type="text"
                  value={label()}
                  onInput={(event) => setLabel(event.currentTarget.value)}
                />
              </label>

              <div class="alarm-dialog__actions">
                <Show when={activeMode() === 'edit' && props.alarm !== undefined}>
                  <button
                    class="alarm-dialog__button alarm-dialog__button--danger"
                    type="button"
                    onClick={requestDeleteConfirmation}
                  >
                    Eliminar
                  </button>
                </Show>
                <button
                  class="alarm-dialog__button alarm-dialog__button--secondary"
                  type="button"
                  onClick={props.onClose}
                >
                  Cancelar
                </button>
                <button class="alarm-dialog__button alarm-dialog__button--primary" type="submit">
                  {activeMode() === 'edit' ? 'Guardar' : 'Añadir'}
                </button>
              </div>
            </form>
          </Match>
        </Switch>
      </div>
    </UiDialog>
  );
}
