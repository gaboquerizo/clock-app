import { expect, test } from '@playwright/test';

test('persists a timer and its absolute timestamps across a page reload', async ({
  page,
}) => {
  const timerId = `timer-persistence-${Date.now()}`;

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
    const created = createTimer({
      id,
      durationMs: 90_000,
      label: 'Persistence check',
      createdAt: 1_000,
    });

    if (!created.ok) {
      throw new Error(`Unable to create test timer: ${created.error.code}`);
    }

    const running = transitionTimer(created.value, 'start', 2_000);

    if (!running.ok) {
      throw new Error(`Unable to start test timer: ${running.error.code}`);
    }

    await timerRepository.create(created.value);
    await timerRepository.update(running.value);
  }, timerId);

  await page.reload();

  const restored = await page.evaluate(async (id) => {
    const repositoryModuleUrl =
      '/src/features/timers/storage/timer-repository.ts';
    const { timerRepository } = await import(repositoryModuleUrl);
    const timer = await timerRepository.get(id);

    if (timer !== undefined) {
      await timerRepository.remove(id);
    }

    return timer;
  }, timerId);

  expect(restored).toEqual({
    id: timerId,
    durationMs: 90_000,
    label: 'Persistence check',
    status: 'running',
    startedAt: 2_000,
    endsAt: 92_000,
    remainingAtStartMs: 90_000,
    createdAt: 1_000,
    updatedAt: 2_000,
  });
});
