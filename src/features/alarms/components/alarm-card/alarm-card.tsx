/*——— Types ———*/
import type { Alarm } from '../../domain/alarm.types';

/*——— Components ———*/
import AppIcon from '../../../../shared/ui/ui-icon/ui-icon';

/*——— Library ———*/
import { createSignal } from 'solid-js';

/*——— Styles ———*/
import './alarm-card.css';

type AlarmCardProps = {
  alarm: Alarm;
  onEdit: () => void;
  onToggle: () => void;
  toggleBusy: boolean;
};

function getAlarmLabel(alarm: Alarm): string {
  return alarm.label || 'Alarma';
}

export default function AlarmCard(props: AlarmCardProps) {
  const [hasInteracted, setHasInteracted] = createSignal(false);
  const statusLabel = () => (props.alarm.enabled ? 'Activada' : 'Desactivada');
  const toggleLabel = () =>
    `${props.alarm.enabled ? 'Desactivar' : 'Activar'} alarma ${props.alarm.time}`;

  const handleToggle = () => {
    setHasInteracted(true);
    props.onToggle();
  };

  return (
    <article
      aria-label={`${props.alarm.time}, ${getAlarmLabel(props.alarm)}, ${statusLabel()}`}
      class={`alarm-card${props.alarm.enabled ? '' : ' alarm-card--disabled'}`}
      data-alarm-id={props.alarm.id}
    >
      <button
        aria-label={`Editar alarma ${props.alarm.time}, ${getAlarmLabel(props.alarm)}`}
        class="alarm-card__edit"
        type="button"
        onClick={props.onEdit}
      >
        <time class="alarm-card__time" datetime={props.alarm.time}>
          {props.alarm.time}
        </time>
        <span class="alarm-card__label">{getAlarmLabel(props.alarm)}</span>
        <span class="alarm-card__status">
          <AppIcon class="alarm-card__status-icon" name="proicons:alarm-clock" />
          <span>{statusLabel()}</span>
        </span>
      </button>

      <button
        aria-checked={props.alarm.enabled}
        aria-label={toggleLabel()}
        class={`alarm-card__toggle t-toggle${hasInteracted() ? ' is-init' : ''}`}
        data-on={String(props.alarm.enabled)}
        disabled={props.toggleBusy}
        role="switch"
        type="button"
        onClick={handleToggle}
      >
        <span class="alarm-card__toggle-thumb t-toggle-thumb" />
      </button>
    </article>
  );
}
