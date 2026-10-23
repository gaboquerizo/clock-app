import { expect, test } from '@playwright/test';

test('refreshes a running timer from the absolute deadline and device clock', async ({
  page,
}) => {
  const referenceTime = new Date('2026-10-23T10:00:00.000Z');
  const timerId = 'timer-countdown-clock-test';
  await page.clock.install({ time: referenceTime });
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
  await expect(remainingTime).toHaveText('00:00:10');

  await page.clock.runFor(1_000);

  await expect(remainingTime).toHaveText('00:00:09');
  expect(await remainingTime.getAttribute('datetime')).toBe('PT9S');
});
