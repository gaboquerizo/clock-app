import { expect, test } from '@playwright/test';

test('completes expired timers on restore and preserves paused remaining time', async ({
  page,
}) => {
  const referenceTime = new Date('2026-10-23T10:00:00.000Z');
  const timerIds = ['timer-expired-on-restore', 'timer-paused-on-restore'];

  await page.clock.install({ time: referenceTime });
  await page.goto('/clock');
  const expectedExpiredAt = await page.evaluate(async (ids) => {
    const repositoryModuleUrl =
      '/src/features/timers/storage/timer-repository.ts';
    const domainModuleUrl = '/src/features/timers/domain/timer.ts';
    const [{ timerRepository }, { createTimer, transitionTimer }] =
      await Promise.all([
        import(repositoryModuleUrl),
        import(domainModuleUrl),
      ]);
    const now = Date.now();
    const expiredBase = createTimer({
      id: ids[0],
      durationMs: 5_000,
      label: 'Expired after suspension',
      createdAt: now - 10_000,
    });
    const pausedBase = createTimer({
      id: ids[1],
      durationMs: 60_000,
      label: 'Paused after suspension',
      createdAt: now - 10_000,
    });

    if (!expiredBase.ok || !pausedBase.ok) {
      throw new Error('Unable to create test timers.');
    }

    const expired = transitionTimer(expiredBase.value, 'start', now - 9_000);
    const pausedStarted = transitionTimer(
      pausedBase.value,
      'start',
      now - 9_000,
    );

    if (!expired.ok || !pausedStarted.ok) {
      throw new Error('Unable to start test timers.');
    }

    const paused = transitionTimer(pausedStarted.value, 'pause', now - 5_000);

    if (!paused.ok) {
      throw new Error('Unable to pause the test timer.');
    }

    await timerRepository.create(expired.value);
    await timerRepository.create(paused.value);
    return expired.value.endsAt;
  }, timerIds);

  await page.reload();
  await page.getByRole('link', { name: 'Temporizador' }).click();

  const expiredCard = page.locator(`[data-timer-id="${timerIds[0]}"]`);
  const pausedCard = page.locator(`[data-timer-id="${timerIds[1]}"]`);

  await expect(expiredCard).toContainText('Finalizado');
  await expect(expiredCard.locator('time.timer-card__remaining')).toHaveText(
    '00:00:00',
  );
  await expect(pausedCard).toContainText('Pausado');
  await expect(pausedCard.locator('time.timer-card__remaining')).toHaveText(
    '00:00:56',
  );

  await page.clock.runFor(30_000);
  await expect(pausedCard.locator('time.timer-card__remaining')).toHaveText(
    '00:00:56',
  );

  const restoredRecords = await page.evaluate(async (ids) => {
    const repositoryModuleUrl =
      '/src/features/timers/storage/timer-repository.ts';
    const { timerRepository } = await import(repositoryModuleUrl);
    const [expired, paused] = await Promise.all(
      ids.map((id) => timerRepository.get(id)),
    );

    return { expired, paused };
  }, timerIds);

  expect(restoredRecords.expired).toMatchObject({
    status: 'completed',
    completedAt: expectedExpiredAt,
  });
  expect(restoredRecords.paused).toMatchObject({
    status: 'paused',
    remainingMs: 56_000,
  });
});
