import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGlobalAlertService } from '@/core/alerts/global-alert-service';
import type { AudioPlaybackRequest, AudioService } from '@/core/services/audio.service';
import type { CompletedTimer } from '@/features/timers/domain/timer.types';
import type { TimerCompletionEvent } from '@/features/timers/state/timers-runtime';
import {
  connectTimersToGlobalAlerts,
  type TimersAlertBridgeOptions,
} from './timers-alert-bridge';

type CompletionListener = (event: TimerCompletionEvent) => void | Promise<void>;

function createRuntimeEmitter() {
  const listeners = new Set<CompletionListener>();

  return {
    runtime: {
      subscribe(listener: CompletionListener) {
        listeners.add(listener);

        return () => listeners.delete(listener);
      },
    },
    emit(event: TimerCompletionEvent) {
      for (const listener of listeners) {
        void listener(event);
      }
    },
  };
}

function createAudioService(
  result: Awaited<ReturnType<AudioService['play']>> = { status: 'playing' },
) {
  const requests: AudioPlaybackRequest[] = [];
  const stoppedSources: string[] = [];
  const service: AudioService = {
    async play(request) {
      requests.push(request);
      return result;
    },
    requestStop(sourceId) {
      stoppedSources.push(sourceId);
    },
  };

  return { service, requests, stoppedSources };
}

function createCompletion(
  id: string,
  label: string,
  completedAt: number,
  reason: TimerCompletionEvent['reason'],
): TimerCompletionEvent {
  const timer: CompletedTimer = {
    id,
    durationMs: 1_000,
    label,
    status: 'completed',
    completedAt,
    createdAt: completedAt - 1_000,
    updatedAt: completedAt,
  };

  return {
    timer,
    observedAt: completedAt,
    scheduledAt: completedAt,
    reason,
  };
}

describe('Timers global alert bridge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('presents activation and recovered completions with an accessible accept action', async () => {
    const alerts = createGlobalAlertService();
    const emitter = createRuntimeEmitter();
    const options: TimersAlertBridgeOptions = { alerts };
    const disconnect = connectTimersToGlobalAlerts(emitter.runtime, options);

    emitter.emit(createCompletion('tea', 'Tea', 20_000, 'activation'));

    let active = alerts.getSnapshot().active;
    expect(active?.request).toMatchObject({
      icon: 'proicons:timer',
      title: 'Temporizador finalizado',
      message: 'Tea',
      primaryActionId: 'accept',
      actions: [
        {
          id: 'accept',
          label: 'Aceptar',
          emphasis: 'primary',
        },
      ],
    });
    if (active === undefined) {
      throw new Error('Expected an active timer alert.');
    }

    await alerts.selectAction(active.id, 'accept');
    expect(alerts.getSnapshot().active).toBeUndefined();

    emitter.emit(createCompletion('untitled', '  ', 30_000, 'recovery'));

    active = alerts.getSnapshot().active;
    expect(active?.request.message).toBe('Temporizador');
    expect(active?.request.title).toBe('Temporizador finalizado');
    expect(active?.request.actions.map(({ label }) => label)).toEqual([
      'Aceptar',
    ]);

    disconnect();
  });

  it('queues one alert per distinct completion, never duplicates one completion, and unsubscribes', () => {
    const alerts = createGlobalAlertService();
    const emitter = createRuntimeEmitter();
    const audio = createAudioService();
    const disconnect = connectTimersToGlobalAlerts(emitter.runtime, {
      alerts,
      audio: audio.service,
    });
    const firstCompletion = createCompletion(
      'timer-1',
      'One',
      40_000,
      'recovery',
    );

    emitter.emit(firstCompletion);
    emitter.emit(firstCompletion);

    expect(alerts.getSnapshot().queuedCount).toBe(0);
    expect(audio.requests).toHaveLength(1);

    emitter.emit(createCompletion('timer-2', 'Two', 40_000, 'activation'));
    expect(alerts.getSnapshot().queuedCount).toBe(1);

    disconnect();
    emitter.emit(createCompletion('timer-3', 'Three', 40_000, 'activation'));

    expect(alerts.getSnapshot().queuedCount).toBe(1);
  });

  it('plays the approved sound in a bounded loop and stops on acceptance or dismissal', async () => {
    const alerts = createGlobalAlertService();
    const emitter = createRuntimeEmitter();
    const audio = createAudioService();
    const disconnect = connectTimersToGlobalAlerts(emitter.runtime, {
      alerts,
      audio: audio.service,
    });

    emitter.emit(createCompletion('timer-a', 'Focus', 50_000, 'activation'));

    expect(audio.requests).toHaveLength(1);
    expect(audio.requests[0]).toMatchObject({
      sourceId: 'timer:timer-a',
      sourceUrl: expect.stringContaining('bells'),
      loop: true,
      maxDurationMs: 60_000,
    });

    const firstAlert = alerts.getSnapshot().active;
    if (firstAlert === undefined) {
      throw new Error('Expected an active timer alert.');
    }
    await alerts.selectAction(firstAlert.id, 'accept');
    expect(audio.stoppedSources).toEqual(['timer:timer-a']);

    emitter.emit(createCompletion('timer-b', 'Break', 60_000, 'recovery'));
    const secondAlert = alerts.getSnapshot().active;
    if (secondAlert === undefined) {
      throw new Error('Expected an active recovered timer alert.');
    }
    await alerts.dismiss(secondAlert.id);

    expect(audio.stoppedSources).toEqual(['timer:timer-a', 'timer:timer-b']);
    disconnect();
  });

  it('keeps the visual alert available when playback is blocked', async () => {
    const alerts = createGlobalAlertService();
    const emitter = createRuntimeEmitter();
    const audio = createAudioService({
      status: 'blocked',
      error: new DOMException('Playback blocked.', 'NotAllowedError'),
    });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const disconnect = connectTimersToGlobalAlerts(emitter.runtime, {
      alerts,
      audio: audio.service,
    });

    emitter.emit(createCompletion('blocked-timer', 'Read', 70_000, 'activation'));
    await Promise.resolve();

    expect(alerts.getSnapshot().active?.request.message).toBe('Read');
    expect(warning).toHaveBeenCalledOnce();
    disconnect();
  });
});
