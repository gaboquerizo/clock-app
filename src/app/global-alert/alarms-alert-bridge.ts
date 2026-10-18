import bellsSoundUrl from '@/assets/sounds/bells.mp3';
import { globalAlertService } from '@/core/alerts/global-alert-service';
import type { GlobalAlertService } from '@/core/alerts/global-alert.types';
import { audioService } from '@/core/services/audio.service';
import type { AudioService } from '@/core/services/audio.service';
import { notificationService } from '@/core/services/notification.service';
import type { NotificationService } from '@/core/services/notification.service';
import type { AlarmsRuntime } from '@/features/alarms/state/alarms-runtime';

const MAX_ALARM_SOUND_DURATION_MS = 60_000;

export type AlarmsAlertBridgeOptions = {
  alerts?: GlobalAlertService;
  audio?: AudioService;
  notifications?: NotificationService;
};

export function connectAlarmsToGlobalAlerts(
  runtime: AlarmsRuntime,
  options: AlarmsAlertBridgeOptions = {},
): () => void {
  const alerts = options.alerts ?? globalAlertService;
  const audio = options.audio ?? audioService;
  const notifications = options.notifications ?? notificationService;
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

    try {
      const notificationResult = notifications.show({
        body: alarm.label.trim() || 'Alarma',
        tag: `clock-app-alarm-${alarm.id}`,
        title: `Alarma · ${alarm.time}`,
      });

      if (notificationResult.status === 'error') {
        console.warn(
          'The browser alarm notification could not be displayed.',
          notificationResult.error,
        );
      }
    } catch (error) {
      console.warn('The browser alarm notification could not be displayed.', error);
    }

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
