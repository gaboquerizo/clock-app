export type AudioPlaybackRequest = {
  sourceId: string;
  sourceUrl: string;
  maxDurationMs: number;
  loop?: boolean;
};

export type AudioPlaybackResult =
  | { status: 'playing' }
  | { status: 'stopped' }
  | { status: 'unavailable' }
  | { status: 'blocked'; error: unknown }
  | { status: 'failed'; error: unknown };

export type AudioService = {
  play(request: AudioPlaybackRequest): Promise<AudioPlaybackResult>;
  requestStop(sourceId: string): void;
};

export type AudioServiceOptions = {
  createAudioElement?: (sourceUrl: string) => HTMLAudioElement;
};

type AudioSession = {
  audio: HTMLAudioElement;
  timeoutId?: ReturnType<typeof setTimeout>;
  onEnded: () => void;
  onError: () => void;
  failure?: unknown;
  playbackSettled: boolean;
  released: boolean;
};

function getErrorName(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('name' in error)) {
    return undefined;
  }

  return String(error.name);
}

function toPlaybackFailure(error: unknown): AudioPlaybackResult {
  return getErrorName(error) === 'NotAllowedError'
    ? { status: 'blocked', error }
    : { status: 'failed', error };
}

function runCleanup(operation: () => void): void {
  try {
    operation();
  } catch (error) {
    console.warn('Audio playback cleanup failed.', error);
  }
}

export function createAudioService(
  options: AudioServiceOptions = {},
): AudioService {
  const activeSessions = new Map<string, AudioSession>();
  const createAudioElement =
    options.createAudioElement ?? ((sourceUrl: string) => new Audio(sourceUrl));

  const release = (sourceId: string, session: AudioSession) => {
    if (session.released) {
      return;
    }

    session.released = true;

    if (session.timeoutId !== undefined) {
      clearTimeout(session.timeoutId);
    }

    runCleanup(() =>
      session.audio.removeEventListener('ended', session.onEnded),
    );
    runCleanup(() =>
      session.audio.removeEventListener('error', session.onError),
    );
    runCleanup(() => session.audio.pause());
    runCleanup(() => {
      session.audio.removeAttribute('src');
      session.audio.load();
    });

    if (activeSessions.get(sourceId) === session) {
      activeSessions.delete(sourceId);
    }
  };

  const requestStop = (sourceId: string) => {
    const session = activeSessions.get(sourceId);

    if (session !== undefined) {
      release(sourceId, session);
    }
  };

  return {
    async play(request) {
      const { sourceId, sourceUrl, maxDurationMs, loop = false } = request;

      if (
        sourceId.length === 0 ||
        sourceUrl.length === 0 ||
        !Number.isFinite(maxDurationMs) ||
        maxDurationMs <= 0
      ) {
        return {
          status: 'failed',
          error: new TypeError(
            'A valid audio source and duration are required.',
          ),
        };
      }

      requestStop(sourceId);

      if (
        options.createAudioElement === undefined &&
        typeof Audio === 'undefined'
      ) {
        return { status: 'unavailable' };
      }

      let audio: HTMLAudioElement;

      try {
        audio = createAudioElement(sourceUrl);
      } catch (error) {
        return toPlaybackFailure(error);
      }

      const session: AudioSession = {
        audio,
        onEnded: () => release(sourceId, session),
        onError: () => {
          session.failure = audio.error ?? new Error('Audio playback failed.');
          release(sourceId, session);

          if (session.playbackSettled) {
            console.warn(
              'Audio playback failed after it started.',
              session.failure,
            );
          }
        },
        playbackSettled: false,
        released: false,
      };

      try {
        audio.preload = 'auto';
        audio.loop = loop;
        activeSessions.set(sourceId, session);
        audio.addEventListener('ended', session.onEnded);
        audio.addEventListener('error', session.onError);
        session.timeoutId = setTimeout(
          () => release(sourceId, session),
          maxDurationMs,
        );

        await audio.play();
      } catch (error) {
        session.playbackSettled = true;

        if (session.failure === undefined && session.released) {
          return { status: 'stopped' };
        }

        session.failure ??= error;
        release(sourceId, session);

        return toPlaybackFailure(session.failure);
      }

      session.playbackSettled = true;

      if (session.failure !== undefined) {
        return toPlaybackFailure(session.failure);
      }

      return activeSessions.get(sourceId) === session
        ? { status: 'playing' }
        : { status: 'stopped' };
    },

    requestStop,
  };
}

export const audioService = createAudioService();
