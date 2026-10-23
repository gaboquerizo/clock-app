import { expect, test } from '@playwright/test';

test('refreshes a running timer from the absolute deadline and device clock', async ({
  page,
}) => {
  const referenceTime = new Date('2026-10-23T10:00:00.000Z');
  const timerId = 'timer-countdown-clock-test';
  await page.clock.install({ time: referenceTime });
  await page.clock.pauseAt(referenceTime);
  await page.goto('/clock');

  await page.evaluate(async (id) => {
    const repositoryModuleUrl =
      '/src/features/timers/storage/timer-repository.ts';
    const domainModuleUrl = '/src/features/timers/domain/timer.ts';
    const [{ timerRepository }, { createTimer, transitionTimer }] =
      await Promise.all([
        import(repositoryModuleUrl),
        import(domainModuleUrl),
      ]);
    const startedAt = Date.now();
    const created = createTimer({
      id,
      durationMs: 10_000,
      label: 'Clock check',
      createdAt: startedAt,
    });

    if (!created.ok) {
      throw new Error(`Unable to create test timer: ${created.error.code}`);
    }

    const started = transitionTimer(created.value, 'start', startedAt);

    if (!started.ok) {
      throw new Error(`Unable to start test timer: ${started.error.code}`);
    }

    await timerRepository.create(started.value);
  }, timerId);

  await page.reload();
  await page.getByRole('link', { name: 'Temporizador' }).click();

  const timerCard = page.getByRole('article', {
    name: 'Clock check, En marcha',
  });
  const remainingTime = timerCard.locator('time.timer-card__remaining');
  const progress = timerCard.getByRole('progressbar', {
    name: 'Progreso de Clock check',
  });
  await expect(remainingTime).toHaveText('00:00:10');
  await expect(progress).toHaveAttribute('aria-valuenow', '0');

  await page.clock.runFor(1_000);

  await expect(remainingTime).toHaveText('00:00:09');
  expect(await remainingTime.getAttribute('datetime')).toBe('PT9S');
  await expect(progress).toHaveAttribute('aria-valuenow', '10');
});

test('updates each timer ring independently and keeps paused progress fixed', async ({
  page,
}) => {
  const referenceTime = new Date('2026-10-23T10:00:00.000Z');
  const runningId = 'timer-progress-running';
  const pausedId = 'timer-progress-paused';
  const readyId = 'timer-progress-ready';
  const completedId = 'timer-progress-completed';
  await page.clock.install({ time: referenceTime });
  await page.clock.pauseAt(referenceTime);
  await page.goto('/clock');

  await page.evaluate(
    async ({ completedId, pausedId, readyId, runningId }) => {
      const repositoryModuleUrl =
        '/src/features/timers/storage/timer-repository.ts';
      const domainModuleUrl = '/src/features/timers/domain/timer.ts';
      const [repositoryModule, domainModule] = await Promise.all([
        import(repositoryModuleUrl),
        import(domainModuleUrl),
      ]);
      const { timerRepository } = repositoryModule;
      const { createTimer, reconcileTimer, transitionTimer } = domainModule;
      const now = Date.now();
      const ready = createTimer({
        id: readyId,
        durationMs: 10_000,
        label: 'Ready test',
        createdAt: now,
      });
      const runningCreated = createTimer({
        id: runningId,
        durationMs: 20_000,
        label: 'Running test',
        createdAt: now,
      });
      const pausedCreated = createTimer({
        id: pausedId,
        durationMs: 20_000,
        label: 'Paused test',
        createdAt: now - 10_000,
      });
      const completedCreated = createTimer({
        id: completedId,
        durationMs: 10_000,
        label: 'Completed test',
        createdAt: now - 10_000,
      });

      if (
        !ready.ok ||
        !runningCreated.ok ||
        !pausedCreated.ok ||
        !completedCreated.ok
      ) {
        throw new Error('Unable to create test timers.');
      }

      const running = transitionTimer(runningCreated.value, 'start', now);
      const pausedStarted = transitionTimer(
        pausedCreated.value,
        'start',
        now - 10_000,
      );
      const completedStarted = transitionTimer(
        completedCreated.value,
        'start',
        now - 10_000,
      );

      if (!running.ok || !pausedStarted.ok || !completedStarted.ok) {
        throw new Error('Unable to initialize test timer states.');
      }

      const paused = transitionTimer(pausedStarted.value, 'pause', now);
      const completed = reconcileTimer(completedStarted.value, now);

      if (
        !paused.ok ||
        !completed.ok ||
        !completed.value.completed
      ) {
        throw new Error('Unable to finalize test timer states.');
      }

      await Promise.all([
        timerRepository.create(ready.value),
        timerRepository.create(running.value),
        timerRepository.create(paused.value),
        timerRepository.create(completed.value.timer),
      ]);
    },
    { completedId, pausedId, readyId, runningId },
  );

  await page.reload();
  await page.getByRole('link', { name: 'Temporizador' }).click();

  const progressFor = (id: string) =>
    page.locator(`[data-timer-id="${id}"] [role="progressbar"]`);
  const runningProgress = progressFor(runningId);
  const pausedProgress = progressFor(pausedId);

  await expect(progressFor(readyId)).toHaveAttribute('aria-valuenow', '0');
  await expect(
    progressFor(readyId).locator('.timer-card__progress-value'),
  ).toHaveAttribute('data-progress-visible', 'false');
  await expect(runningProgress).toHaveAttribute('aria-valuenow', '0');
  await expect(pausedProgress).toHaveAttribute('aria-valuenow', '50');
  await expect(progressFor(completedId)).toHaveAttribute('aria-valuenow', '100');

  await page.clock.runFor(1_000);

  await expect(runningProgress).toHaveAttribute('aria-valuenow', '5');
  await expect(pausedProgress).toHaveAttribute('aria-valuenow', '50');
});
