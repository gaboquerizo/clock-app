import bellsSoundUrl from '@/assets/sounds/bells.mp3';
import { audioService } from '@/core/services/audio.service';
import type { AudioService } from '@/core/services/audio.service';
import { notificationService } from '@/core/services/notification.service';
import type { NotificationService } from '@/core/services/notification.service';
import { globalAlertService } from '@/core/alerts/global-alert-service';
import type { GlobalAlertService } from '@/core/alerts/global-alert.types';
import type { TimersRuntime } from '@/features/timers/state/timers-runtime';

const MAX_TIMER_SOUND_DURATION_MS = 60_000;

export type TimersAlertBridgeOptions = {
  alerts?: GlobalAlertService;
  audio?: AudioService;
  notifications?: NotificationService;
};

export function connectTimersToGlobalAlerts(
  runtime: Pick<TimersRuntime, 'subscribe'>,
  options: TimersAlertBridgeOptions = {},
): () => void {
  const alerts = options.alerts ?? globalAlertService;
  const audio = options.audio ?? audioService;
  const notifications = options.notifications ?? notificationService;
  const presentedCompletions = new Set<string>();

  return runtime.subscribe((event) => {
    const { timer } = event;
    const completionId = `${timer.id}:${timer.completedAt}`;

    if (presentedCompletions.has(completionId)) {
      return;
    }

    presentedCompletions.add(completionId);
    const sourceId = `timer:${completionId}`;
    let soundStopped = false;

    const stopSound = () => {
      if (soundStopped) {
        return;
      }

      soundStopped = true;

      try {
        audio.requestStop(sourceId);
      } catch (error) {
        console.warn('The default timer sound could not be stopped.', error);
      }
    };

    const playSound = () => {
      if (soundStopped) {
        return;
      }

      let playback: Promise<Awaited<ReturnType<AudioService['play']>>>;

      try {
        playback = audio.play({
          sourceId,
          sourceUrl: bellsSoundUrl,
          maxDurationMs: MAX_TIMER_SOUND_DURATION_MS,
          loop: true,
        });
      } catch (error) {
        console.warn('The default timer sound could not be played.', error);
        return;
      }

      void playback
        .then((result) => {
          if (result.status === 'blocked' || result.status === 'failed') {
            console.warn(
              'The default timer sound could not be played.',
              result.error,
            );
          }
        })
        .catch((error: unknown) => {
          console.warn('The default timer sound could not be played.', error);
        });
    };

    const label = timer.label.trim() || 'Temporizador';

    if (event.reason === 'activation') {
      try {
        const notificationResult = notifications.show({
          body: label,
          tag: `clock-app-timer-${timer.id}`,
          title: 'Temporizador finalizado',
        });

        if (notificationResult.status === 'error') {
          console.warn(
            'The browser timer notification could not be displayed.',
            notificationResult.error,
          );
        }
      } catch (error) {
        console.warn(
          'The browser timer notification could not be displayed.',
          error,
        );
      }
    }

    alerts.present({
      eventId: `timer:${completionId}`,
      icon: 'proicons:timer',
      title: 'Temporizador finalizado',
      message: label,
      actions: [
        {
          id: 'accept',
          label: 'Aceptar',
          emphasis: 'primary',
          onSelect: stopSound,
        },
      ],
      primaryActionId: 'accept',
      onActivate: playSound,
      onDismiss: stopSound,
    });
  });
}
