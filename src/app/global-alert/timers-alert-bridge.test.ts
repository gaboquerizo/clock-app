import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGlobalAlertService } from '@/core/alerts/global-alert-service';
import type { AudioPlaybackRequest, AudioService } from '@/core/services/audio.service';
import type {
  NotificationDisplayRequest,
  NotificationDisplayResult,
  NotificationRequestResult,
  NotificationService,
} from '@/core/services/notification.service';
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

function createNotificationService(
  result: NotificationDisplayResult = { status: 'shown' },
) {
  const requests: NotificationDisplayRequest[] = [];
  let permissionRequests = 0;
  const service: NotificationService = {
    getPermission() {
      return 'granted';
    },
    async requestPermission(): Promise<NotificationRequestResult> {
      permissionRequests += 1;
      return { status: 'granted' };
    },
    show(request) {
      requests.push(request);
      return result;
    },
  };

  return {
    service,
    requests,
    get permissionRequests() {
      return permissionRequests;
    },
  };
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
    const notifications = createNotificationService();
    const disconnect = connectTimersToGlobalAlerts(emitter.runtime, {
      alerts,
      audio: audio.service,
      notifications: notifications.service,
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
    expect(notifications.requests).toEqual([
      {
        title: 'Temporizador finalizado',
        body: 'One',
        tag: 'clock-app-timer-timer-1',
      },
    ]);

    emitter.emit(createCompletion('timer-2', 'Two', 40_000, 'activation'));
    expect(alerts.getSnapshot().queuedCount).toBe(1);
    expect(notifications.requests).toHaveLength(2);

    disconnect();
    emitter.emit(createCompletion('timer-3', 'Three', 40_000, 'activation'));

    expect(alerts.getSnapshot().queuedCount).toBe(1);
    expect(notifications.requests).toHaveLength(2);
  });

  it('uses a fallback label and stable tag for a notification', () => {
    const alerts = createGlobalAlertService();
    const emitter = createRuntimeEmitter();
    const notifications = createNotificationService();
    const disconnect = connectTimersToGlobalAlerts(emitter.runtime, {
      alerts,
      notifications: notifications.service,
    });

    emitter.emit(createCompletion('untitled-timer', '  ', 45_000, 'activation'));

    expect(notifications.requests).toEqual([
      {
        title: 'Temporizador finalizado',
        body: 'Temporizador',
        tag: 'clock-app-timer-untitled-timer',
      },
    ]);
    expect(alerts.getSnapshot().active?.request.message).toBe('Temporizador');
    expect(notifications.permissionRequests).toBe(0);
    disconnect();
  });

  it.each([
    { status: 'permission-required' as const },
    { status: 'unsupported' as const },
  ])('keeps the app alert and sound when notifications are $status', (result) => {
    const alerts = createGlobalAlertService();
    const emitter = createRuntimeEmitter();
    const notifications = createNotificationService(result);
    const audio = createAudioService();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const disconnect = connectTimersToGlobalAlerts(emitter.runtime, {
      alerts,
      audio: audio.service,
      notifications: notifications.service,
    });

    emitter.emit(createCompletion('restricted-timer', 'Focus', 46_000, 'activation'));

    expect(alerts.getSnapshot().active?.request.message).toBe('Focus');
    expect(audio.requests).toHaveLength(1);
    expect(warning).not.toHaveBeenCalled();
    expect(notifications.permissionRequests).toBe(0);
    disconnect();
  });

  it('contains notification API failures without interrupting the app alert or sound', () => {
    const alerts = createGlobalAlertService();
    const emitter = createRuntimeEmitter();
    const notifications = createNotificationService({
      status: 'error',
      error: new Error('Notification constructor failed.'),
    });
    const audio = createAudioService();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const disconnect = connectTimersToGlobalAlerts(emitter.runtime, {
      alerts,
      audio: audio.service,
      notifications: notifications.service,
    });

    emitter.emit(createCompletion('api-error-timer', 'Read', 47_000, 'activation'));

    expect(alerts.getSnapshot().active?.request.message).toBe('Read');
    expect(audio.requests).toHaveLength(1);
    expect(warning).toHaveBeenCalledOnce();
    expect(notifications.permissionRequests).toBe(0);
    disconnect();
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
