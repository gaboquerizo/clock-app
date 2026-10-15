import type { Alarm } from '../domain/alarm.types';

import AppIcon from '../../../shared/ui/ui-icon/ui-icon';

import './alarm-card.css';

type AlarmCardProps = {
  alarm: Alarm;
};

function getAlarmLabel(alarm: Alarm): string {
  return alarm.label || 'Alarma';
}

export default function AlarmCard(props: AlarmCardProps) {
  const statusLabel = () => (props.alarm.enabled ? 'Activada' : 'Desactivada');

  return (
    <article
      aria-label={`${props.alarm.time}, ${getAlarmLabel(props.alarm)}, ${statusLabel()}`}
      class={`alarm-card${props.alarm.enabled ? '' : ' alarm-card--disabled'}`}
      data-alarm-id={props.alarm.id}
    >
      <time class="alarm-card__time" datetime={props.alarm.time}>
        {props.alarm.time}
      </time>
      <p class="alarm-card__label">{getAlarmLabel(props.alarm)}</p>
      <div class="alarm-card__status">
        <AppIcon class="alarm-card__status-icon" name="proicons:alarm-clock" />
        <span>{statusLabel()}</span>
      </div>
    </article>
  );
}
