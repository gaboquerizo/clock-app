import { globalAlertService } from '@/core/alerts/global-alert-service';
import type {
  GlobalAlertAction,
  GlobalAlertService,
} from '@/core/alerts/global-alert.types';
import type { PomodoroBlockType } from '@/features/pomodoro/domain/pomodoro.types';
import type { PomodoroRuntime } from '@/features/pomodoro/state/pomodoro-runtime';
import type {
  PomodoroCompletionMetadata,
  PomodoroStateController,
} from '@/features/pomodoro/state/pomodoro-state';

const COMPLETED_BLOCK_LABELS: Record<PomodoroBlockType, string> = {
  focus: 'Concentración',
  'short-break': 'Descanso corto',
  'long-break': 'Descanso largo',
};
const COMPLETED_BLOCK_TITLES: Record<PomodoroBlockType, string> = {
  focus: 'Concentración completada',
  'short-break': 'Descanso corto completado',
  'long-break': 'Descanso largo completado',
};

export type PomodoroAlertBridgeOptions = {
  alerts?: GlobalAlertService;
};

function formatDuration(durationMs: number): string {
  const minutes = Math.round(durationMs / 60_000);

  return `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
}

function canStartPreparedBlock(
  pomodoro: PomodoroStateController,
  expectedCycleId: string,
  expectedBlockId: string,
  expectedDurationMs: number,
  completedCycleId: string,
  completedBlockId: string,
): boolean {
  const cycle = pomodoro.state.cycle;
  const receipt = pomodoro.state.lastProcessedCompletion;

  return (
    pomodoro.state.status === 'ready' &&
    cycle?.status === 'ready' &&
    cycle.id === expectedCycleId &&
    cycle.currentBlock.id === expectedBlockId &&
    cycle.currentBlock.durationMs === expectedDurationMs &&
    receipt?.cycleId === completedCycleId &&
    receipt.blockExecutionId === completedBlockId
  );
}

export function connectPomodoroToGlobalAlerts(
  runtime: Pick<PomodoroRuntime, 'subscribe'>,
  pomodoro: PomodoroStateController,
  options: PomodoroAlertBridgeOptions = {},
): () => void {
  const alerts = options.alerts ?? globalAlertService;
  const processedEventIds = new Set<string>();
  const processingEventIds = new Set<string>();

  return runtime.subscribe(async (event) => {
    const eventId = `pomodoro:${event.cycleId}:${event.blockExecutionId}`;

    if (
      processedEventIds.has(eventId) ||
      processingEventIds.has(eventId)
    ) {
      return;
    }

    processingEventIds.add(eventId);

    try {
      const existingReceipt = pomodoro.state.lastProcessedCompletion;

      if (
        existingReceipt?.cycleId === event.cycleId &&
        existingReceipt.blockExecutionId === event.blockExecutionId
      ) {
        processedEventIds.add(eventId);
        return;
      }

      const metadata: PomodoroCompletionMetadata = {
        reason: event.reason,
        scheduledAt: event.scheduledAt,
        observedAt: event.observedAt,
      };
      const result = await pomodoro.actions.completeBlock(event, metadata);

      if (!result.ok) {
        console.warn(
          'The Pomodoro completion could not be processed.',
          result.error,
        );
        return;
      }

      processedEventIds.add(eventId);

      if (event.reason === 'recovery') {
        return;
      }

      const receipt = pomodoro.state.lastProcessedCompletion;

      if (
        receipt?.cycleId !== event.cycleId ||
        receipt.blockExecutionId !== event.blockExecutionId ||
        result.value.status !== 'ready'
      ) {
        return;
      }

      const nextCycle = result.value;
      const nextBlock = nextCycle.currentBlock;
      const nextBlockLabel = COMPLETED_BLOCK_LABELS[nextBlock.type];
      const canStartNext = () =>
        canStartPreparedBlock(
          pomodoro,
          nextCycle.id,
          nextBlock.id,
          nextBlock.durationMs,
          event.cycleId,
          event.blockExecutionId,
        );

      const startNext: GlobalAlertAction = {
        id: 'start-next',
        label: 'Iniciar siguiente',
        emphasis: 'secondary',
        isEnabled: canStartNext,
        async onSelect() {
          if (!canStartNext()) {
            return;
          }

          const startResult = await pomodoro.actions.start();

          if (!startResult.ok) {
            throw new Error(startResult.error.message);
          }
        },
      };

      alerts.present({
        eventId,
        icon: 'proicons:timer',
        title: COMPLETED_BLOCK_TITLES[event.blockType],
        message: `Siguiente: ${nextBlockLabel.toLowerCase()} de ${formatDuration(nextBlock.durationMs)}.`,
        actions: [
          {
            id: 'accept',
            label: 'Aceptar',
            emphasis: 'primary',
            onSelect: () => undefined,
          },
        ],
        secondaryAction: startNext,
        primaryActionId: 'accept',
      });
    } catch (error) {
      console.warn(
        'The Pomodoro completion alert could not be presented.',
        error,
      );
    } finally {
      processingEventIds.delete(eventId);
    }
  });
}
