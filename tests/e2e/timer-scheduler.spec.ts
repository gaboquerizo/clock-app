import { expect, test } from '@playwright/test';

test('keeps independent timer schedules active while navigating between routes', async ({
  page,
}) => {
  const referenceTime = new Date('2026-10-23T10:00:00.000Z');
  const timerIds = ['scheduler-short-timer', 'scheduler-long-timer'];

  await page.clock.install({ time: referenceTime });
  await page.goto('/clock');
  await page.evaluate(async (ids) => {
    const repositoryModuleUrl =
      '/src/features/timers/storage/timer-repository.ts';
    const domainModuleUrl = '/src/features/timers/domain/timer.ts';
    const [{ timerRepository }, { createTimer, transitionTimer }] =
      await Promise.all([
        import(repositoryModuleUrl),
        import(domainModuleUrl),
      ]);
    const startedAt = Date.now();

    for (const [index, id] of ids.entries()) {
      const durationMs = index === 0 ? 2_000 : 4_000;
      const created = createTimer({
        id,
        durationMs,
        label: index === 0 ? 'Short timer' : 'Long timer',
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
    }
  }, timerIds);

  await page.reload();
  await page.getByRole('link', { name: 'Temporizador' }).click();

  await expect(
    page.getByRole('article', { name: 'Short timer, En marcha' }),
  ).toBeVisible();
  await expect(
    page.getByRole('article', { name: 'Long timer, En marcha' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Reloj' }).click();
  await page.clock.runFor(2_000);

  const shortTimerAlert = page.getByRole('dialog', {
    name: 'Temporizador finalizado',
  });
  await expect(shortTimerAlert).toContainText('Short timer');
  await page.keyboard.press('Enter');
  await expect(shortTimerAlert).not.toBeVisible();

  await page.getByRole('link', { name: 'Temporizador' }).click();

  await expect(
    page.getByRole('article', { name: 'Short timer, Finalizado' }),
  ).toBeVisible();
  await expect(
    page.getByRole('article', { name: 'Long timer, En marcha' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Reloj' }).click();
  await page.clock.runFor(2_000);

  const longTimerAlert = page.getByRole('dialog', {
    name: 'Temporizador finalizado',
  });
  await expect(longTimerAlert).toContainText('Long timer');
  await page.keyboard.press('Enter');
  await expect(longTimerAlert).not.toBeVisible();

  await page.getByRole('link', { name: 'Temporizador' }).click();

  await expect(
    page.getByRole('article', { name: 'Long timer, Finalizado' }),
  ).toBeVisible();
});
