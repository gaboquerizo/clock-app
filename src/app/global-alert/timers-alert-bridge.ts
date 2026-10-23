import bellsSoundUrl from '@/assets/sounds/bells.mp3';
import { audioService } from '@/core/services/audio.service';
import type { AudioService } from '@/core/services/audio.service';
import { globalAlertService } from '@/core/alerts/global-alert-service';
import type { GlobalAlertService } from '@/core/alerts/global-alert.types';
import type { TimersRuntime } from '@/features/timers/state/timers-runtime';

const MAX_TIMER_SOUND_DURATION_MS = 60_000;

export type TimersAlertBridgeOptions = {
  alerts?: GlobalAlertService;
  audio?: AudioService;
};

export function connectTimersToGlobalAlerts(
  runtime: Pick<TimersRuntime, 'subscribe'>,
  options: TimersAlertBridgeOptions = {},
): () => void {
  const alerts = options.alerts ?? globalAlertService;
  const audio = options.audio ?? audioService;
  const presentedCompletions = new Set<string>();

  return runtime.subscribe(({ timer }) => {
    const completionId = `${timer.id}:${timer.completedAt}`;

    if (presentedCompletions.has(completionId)) {
      return;
    }

    presentedCompletions.add(completionId);
    const sourceId = `timer:${timer.id}`;
    let soundStopped = false;

    const stopSound = () => {
      if (soundStopped) {
        return;
      }

      soundStopped = true;
      audio.requestStop(sourceId);
    };

    alerts.present({
      icon: 'proicons:timer',
      title: 'Temporizador finalizado',
      message: timer.label.trim() || 'Temporizador',
      actions: [
        {
          id: 'accept',
          label: 'Aceptar',
          emphasis: 'primary',
          onSelect: stopSound,
        },
      ],
      primaryActionId: 'accept',
      onDismiss: stopSound,
    });

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
  });
}
