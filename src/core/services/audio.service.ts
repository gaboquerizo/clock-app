export type AudioStopRequestListener = (sourceId: string) => void;

export type AudioService = {
  subscribeToStopRequests(listener: AudioStopRequestListener): () => void;
  requestStop(sourceId: string): void;
};

export function createAudioService(): AudioService {
  const listeners = new Set<AudioStopRequestListener>();

  return {
    subscribeToStopRequests(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    requestStop(sourceId) {
      for (const listener of listeners) {
        listener(sourceId);
      }
    },
  };
}

export const audioService = createAudioService();
