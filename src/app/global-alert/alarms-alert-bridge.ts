import bellsSoundUrl from '@/assets/sounds/bells.mp3';
import { globalAlertService } from '@/core/alerts/global-alert-service';
import type { GlobalAlertService } from '@/core/alerts/global-alert.types';
import { audioService } from '@/core/services/audio.service';
import type { AudioService } from '@/core/services/audio.service';
import type { AlarmsRuntime } from '@/features/alarms/state/alarms-runtime';

const MAX_ALARM_SOUND_DURATION_MS = 60_000;

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

    void audio
      .play({
        sourceId: alarm.id,
        sourceUrl: bellsSoundUrl,
        maxDurationMs: MAX_ALARM_SOUND_DURATION_MS,
        loop: true,
      })
      .then((result) => {
        if (result.status === 'failed') {
          console.warn(
            'The default alarm sound could not be played.',
            result.error,
          );
        }
      })
      .catch((error: unknown) => {
        console.warn('The default alarm sound could not be played.', error);
      });
  });
}
