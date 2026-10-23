import { expect, test } from '@playwright/test';

test('controls timer playback independently and preserves absolute state', async ({
  page,
}) => {
  const referenceTime = new Date('2026-10-23T10:00:00.000Z');
  const timerIds = {
    ready: 'timer-playback-ready',
    paused: 'timer-playback-paused',
    completed: 'timer-playback-completed',
  };

  await page.clock.install({ time: referenceTime });
  await page.clock.pauseAt(referenceTime);
  await page.goto('/clock');

  await page.evaluate(async (ids) => {
    const repositoryModuleUrl =
      '/src/features/timers/storage/timer-repository.ts';
    const domainModuleUrl = '/src/features/timers/domain/timer.ts';
    const [{ timerRepository }, { createTimer, reconcileTimer, transitionTimer }] =
      await Promise.all([
        import(repositoryModuleUrl),
        import(domainModuleUrl),
      ]);
    const now = Date.now();
    const ready = createTimer({
      id: ids.ready,
      durationMs: 120_000,
      label: 'Ready timer',
      createdAt: now,
    });
    const pausedBase = createTimer({
      id: ids.paused,
      durationMs: 90_000,
      label: 'Paused timer',
      createdAt: now - 100_000,
    });
    const completedBase = createTimer({
      id: ids.completed,
      durationMs: 45_000,
      label: 'Completed timer',
      createdAt: now - 100_000,
    });

    if (!ready.ok || !pausedBase.ok || !completedBase.ok) {
      throw new Error('Unable to create playback test timers.');
    }

    const pausedStarted = transitionTimer(
      pausedBase.value,
      'start',
      now - 90_000,
    );
    const completedStarted = transitionTimer(
      completedBase.value,
      'start',
      now - 45_000,
    );

    if (!pausedStarted.ok || !completedStarted.ok) {
      throw new Error('Unable to initialize playback test states.');
    }

    const paused = transitionTimer(pausedStarted.value, 'pause', now - 45_000);
    const completed = reconcileTimer(completedStarted.value, now);

    if (!paused.ok || !completed.ok || !completed.value.completed) {
      throw new Error('Unable to create paused and completed test states.');
    }

    await Promise.all([
      timerRepository.create(ready.value),
      timerRepository.create(paused.value),
      timerRepository.create(completed.value.timer),
    ]);
  }, timerIds);

  await page.reload();
  await page.getByRole('link', { name: 'Temporizador' }).click();

  const card = (timerId: string) =>
    page.locator(`[data-timer-id="${timerId}"]`);
  const readyCard = card(timerIds.ready);
  const pausedCard = card(timerIds.paused);
  const completedCard = card(timerIds.completed);

  const start = readyCard.getByRole('button', {
    name: 'Iniciar temporizador Ready timer',
  });
  await start.focus();
  await page.keyboard.press('Enter');
  await expect(readyCard).toHaveAttribute(
    'aria-label',
    'Ready timer, En marcha',
  );
  await expect(
    readyCard.getByRole('button', {
      name: 'Pausar temporizador Ready timer',
    }),
  ).toBeFocused();
  await expect(readyCard.locator('time.timer-card__remaining')).toHaveText(
    '00:02:00',
  );

  await page.clock.runFor(7_000);
  const pause = readyCard.getByRole('button', {
    name: 'Pausar temporizador Ready timer',
  });
  await pause.focus();
  await page.keyboard.press('Space');
  await expect(readyCard).toHaveAttribute('aria-label', 'Ready timer, Pausado');
  await expect(
    readyCard.getByRole('button', {
      name: 'Reanudar temporizador Ready timer',
    }),
  ).toBeFocused();
  await expect(readyCard.locator('time.timer-card__remaining')).toHaveText(
    '00:01:53',
  );

  await page.clock.runFor(5_000);
  await expect(readyCard.locator('time.timer-card__remaining')).toHaveText(
    '00:01:53',
  );

  await readyCard
    .getByRole('button', { name: 'Reanudar temporizador Ready timer' })
    .press('Enter');
  await expect(readyCard).toHaveAttribute(
    'aria-label',
    'Ready timer, En marcha',
  );

  await readyCard
    .getByRole('button', { name: 'Reiniciar temporizador Ready timer' })
    .press('Enter');
  await expect(readyCard.locator('time.timer-card__remaining')).toHaveText(
    '00:02:00',
  );
  await expect(readyCard.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '0',
  );

  await pausedCard
    .getByRole('button', { name: 'Reiniciar temporizador Paused timer' })
    .press('Space');
  await expect(pausedCard).toHaveAttribute(
    'aria-label',
    'Paused timer, Pausado',
  );
  await expect(pausedCard.locator('time.timer-card__remaining')).toHaveText(
    '00:01:30',
  );

  await completedCard
    .getByRole('button', { name: 'Reiniciar temporizador Completed timer' })
    .press('Enter');
  await expect(completedCard).toHaveAttribute(
    'aria-label',
    'Completed timer, Listo',
  );
  await expect(completedCard.getByRole('button', {
    name: 'Iniciar temporizador Completed timer',
  })).toBeVisible();

  await expect(pausedCard).toHaveAttribute(
    'aria-label',
    'Paused timer, Pausado',
  );
  await expect(readyCard).toHaveAttribute(
    'aria-label',
    'Ready timer, En marcha',
  );

  const storedTimers = await page.evaluate(async (ids) => {
    const repositoryModuleUrl =
      '/src/features/timers/storage/timer-repository.ts';
    const { timerRepository } = await import(repositoryModuleUrl);
    const [ready, paused, completed] = await Promise.all(
      [ids.ready, ids.paused, ids.completed].map((id) =>
        timerRepository.get(id),
      ),
    );

    return { ready, paused, completed };
  }, timerIds);

  expect(storedTimers.ready).toMatchObject({
    status: 'running',
    remainingAtStartMs: 120_000,
    endsAt: referenceTime.getTime() + 12_000 + 120_000,
  });
  expect(storedTimers.paused).toMatchObject({
    status: 'paused',
    remainingMs: 90_000,
  });
  expect(storedTimers.completed).toMatchObject({
    status: 'ready',
    remainingMs: 45_000,
  });

  await page.reload();
  await page.getByRole('link', { name: 'Temporizador' }).click();
  await expect(card(timerIds.ready)).toHaveAttribute(
    'aria-label',
    'Ready timer, En marcha',
  );
  await expect(card(timerIds.paused)).toHaveAttribute(
    'aria-label',
    'Paused timer, Pausado',
  );
  await expect(card(timerIds.completed)).toHaveAttribute(
    'aria-label',
    'Completed timer, Listo',
  );
});
