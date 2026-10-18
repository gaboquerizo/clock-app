import { globalAlertService } from '@/core/alerts/global-alert-service';
import type { GlobalAlertService } from '@/core/alerts/global-alert.types';
import { audioService } from '@/core/services/audio.service';
import type { AudioService } from '@/core/services/audio.service';
import type { AlarmsRuntime } from '@/features/alarms/state/alarms-runtime';

export type AlarmsAlertBridgeOptions = {
  alerts?: GlobalAlertService;
  audio?: AudioService;
};

export function connectAlarmsToGlobalAlerts(
  runtime: AlarmsRuntime,
  options: AlarmsAlertBridgeOptions = {},
): () => void {
  const alerts = options.alerts ?? globalAlertService;
  const audio = options.audio ?? audioService;
  const presentedActivations = new Set<string>();

  return runtime.subscribe(({ alarm }) => {
    if (alarm.status !== 'triggered' || alarm.triggeredAt === undefined) {
      return;
    }

    const activationId = `${alarm.id}:${alarm.triggeredAt}`;

    if (presentedActivations.has(activationId)) {
      return;
    }

    presentedActivations.add(activationId);

    let accepted = false;

    const acceptAlarm = () => {
      if (accepted) {
        return;
      }

      audio.requestStop(alarm.id);
      accepted = true;
    };

    alerts.present({
      icon: 'proicons:alarm-clock',
      title: `Alarma · ${alarm.time}`,
      message: alarm.label.trim() || 'Alarma',
      actions: [
        {
          id: 'accept',
          label: 'Aceptar',
          emphasis: 'primary',
          onSelect: acceptAlarm,
        },
      ],
      primaryActionId: 'accept',
      onDismiss: acceptAlarm,
    });
  });
}
