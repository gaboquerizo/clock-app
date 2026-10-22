import { expect, test } from '@playwright/test';

test('navigates to Timers while keeping the app shell and existing routes available', async ({
  page,
}) => {
  await page.goto('/clock');

  const main = page.getByRole('main');
  const navigation = page.getByRole('navigation', {
    name: 'Navegación principal',
  });
  const sidebar = page
    .getByRole('complementary')
    .filter({ has: navigation });

  await expect(main.getByRole('heading', { name: 'Reloj' })).toBeVisible();
  await expect(sidebar).toBeVisible();

  await navigation.getByRole('link', { name: 'Temporizador' }).click();
  await expect(page).toHaveURL(/\/timers$/);
  await expect(
    main.getByRole('heading', { name: 'Temporizador', exact: true }),
  ).toBeVisible();
  const emptyState = main.getByRole('region', {
    name: 'No tienes temporizadores todavía.',
  });
  await expect(emptyState).toBeVisible();
  await expect(
    emptyState.getByRole('button', { name: 'Añadir temporizador' }),
  ).toBeVisible();
  await expect(
    main.getByRole('button', { name: 'Añadir temporizador' }),
  ).toHaveCount(1);
  await expect(main.locator('.timers-view__content-body')).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(
    navigation.getByRole('link', { name: 'Temporizador' }),
  ).toHaveClass(/app-sidebar__menu-link--active/);

  await page.setViewportSize({ width: 768, height: 900 });
  const timerButtonBounds = await main
    .getByRole('button', { name: 'Añadir temporizador' })
    .boundingBox();
  const mainBounds = await main.boundingBox();
  if (timerButtonBounds === null || mainBounds === null) {
    throw new Error('Expected the timer action and main region to have bounds.');
  }
  expect(timerButtonBounds.x).toBeGreaterThanOrEqual(mainBounds.x);
  expect(timerButtonBounds.x + timerButtonBounds.width).toBeLessThanOrEqual(
    mainBounds.x + mainBounds.width,
  );
  await page.setViewportSize({ width: 1280, height: 800 });

  await navigation.getByRole('link', { name: 'Alarma' }).click();
  await expect(page).toHaveURL(/\/alarms$/);
  await expect(
    main.getByRole('heading', { name: 'Alarma', exact: true }),
  ).toBeVisible();
  await expect(sidebar).toBeVisible();

  await navigation.getByRole('link', { name: 'Reloj' }).click();
  await expect(page).toHaveURL(/\/clock$/);
  await expect(main.getByRole('heading', { name: 'Reloj' })).toBeVisible();
  await expect(sidebar).toBeVisible();
});

test('renders persisted timer records as independent cards with real states', async ({
  page,
}) => {
  const timerIds = {
    ready: `timer-ready-${Date.now()}`,
    running: `timer-running-${Date.now()}`,
    paused: `timer-paused-${Date.now()}`,
    completed: `timer-completed-${Date.now()}`,
  };

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
      label: '',
      createdAt: now,
    });
    const runningBase = createTimer({
      id: ids.running,
      durationMs: 3_600_000,
      label: 'En curso',
      createdAt: now - 1_000,
    });
    const pausedBase = createTimer({
      id: ids.paused,
      durationMs: 90_000,
      label: 'Pausa breve',
      createdAt: now,
    });
    const completedBase = createTimer({
      id: ids.completed,
      durationMs: 30_000,
      label: 'Terminado',
      createdAt: now - 60_000,
    });

    if (!ready.ok || !runningBase.ok || !pausedBase.ok || !completedBase.ok) {
      throw new Error('Unable to create timer fixtures.');
    }

    const running = transitionTimer(runningBase.value, 'start', now - 1_000);
    const pausedStarted = transitionTimer(pausedBase.value, 'start', now);
    const completedStarted = transitionTimer(
      completedBase.value,
      'start',
      now - 60_000,
    );

    if (!running.ok || !pausedStarted.ok || !completedStarted.ok) {
      throw new Error('Unable to transition timer fixtures.');
    }

    const paused = transitionTimer(pausedStarted.value, 'pause', now + 60_000);
    const completed = reconcileTimer(
      completedStarted.value,
      completedStarted.value.endsAt,
    );

    if (!paused.ok || !completed.ok) {
      throw new Error('Unable to finish timer fixtures.');
    }

    await timerRepository.create(ready.value);
    await timerRepository.create(running.value);
    await timerRepository.create(paused.value);
    await timerRepository.create(completed.value.timer);
  }, timerIds);

  await page.reload();
  await page.getByRole('link', { name: 'Temporizador' }).click();

  const list = page.getByRole('list', { name: 'Temporizadores configurados' });
  await expect(list).toBeVisible();
  await expect(list.getByRole('listitem')).toHaveCount(4);

  const readyCard = page.locator(`[data-timer-id="${timerIds.ready}"]`);
  const runningCard = page.locator(`[data-timer-id="${timerIds.running}"]`);
  const pausedCard = page.locator(`[data-timer-id="${timerIds.paused}"]`);
  const completedCard = page.locator(`[data-timer-id="${timerIds.completed}"]`);

  await expect(readyCard).toContainText('Temporizador');
  await expect(readyCard).toContainText('Listo');
  await expect(readyCard).toContainText('00:02:00');
  await expect(runningCard).toContainText('En curso');
  await expect(runningCard).toContainText('En marcha');
  await expect(pausedCard).toContainText('Pausa breve');
  await expect(pausedCard).toContainText('Pausado');
  await expect(pausedCard).toContainText('00:00:30');
  await expect(completedCard).toContainText('Terminado');
  await expect(completedCard).toContainText('Finalizado');
  await expect(completedCard).toContainText('00:00:00');
  const firstCardBounds = await list.getByRole('listitem').nth(0).boundingBox();
  const secondCardBounds = await list.getByRole('listitem').nth(1).boundingBox();
  if (firstCardBounds === null || secondCardBounds === null) {
    throw new Error('Expected timer cards to have visible bounds.');
  }
  expect(Math.abs(firstCardBounds.x - secondCardBounds.x)).toBeGreaterThan(0);
  expect(Math.abs(firstCardBounds.y - secondCardBounds.y)).toBeLessThan(1);

  await page.setViewportSize({ width: 768, height: 900 });
  const mainBounds = await page.getByRole('main').boundingBox();
  const responsiveListBounds = await list.boundingBox();
  if (mainBounds === null || responsiveListBounds === null) {
    throw new Error('Expected the responsive timer list to have visible bounds.');
  }
  expect(responsiveListBounds.x).toBeGreaterThanOrEqual(mainBounds.x);
  expect(responsiveListBounds.x + responsiveListBounds.width).toBeLessThanOrEqual(
    mainBounds.x + mainBounds.width,
  );

  await expect(
    list.getByRole('button', { name: /Iniciar|Pausar|Editar/ }),
  ).toHaveCount(0);
});
