import { expect, test, type Page } from '@playwright/test';

const referenceTime = new Date('2026-11-04T12:00:00.000Z');

async function installFrozenClock(page: Page) {
  await page.clock.install({ time: referenceTime });
  await page.clock.pauseAt(referenceTime);
}

test('navigates to Stopwatch and adapts its layout to desktop and tablet', async ({
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
  const stopwatchLink = navigation.getByRole('link', {
    name: 'Cronómetro',
  });

  await stopwatchLink.click();
  await expect(page).toHaveURL(/\/stopwatch$/);
  await expect(
    main.getByRole('heading', { name: 'Cronómetro', exact: true }),
  ).toBeVisible();
  await expect(
    main.getByRole('region', { name: 'Tiempo transcurrido', exact: true }),
  ).toBeVisible();
  await expect(
    main.getByRole('region', { name: 'Controles principales', exact: true }),
  ).toBeVisible();
  const lapsRegion = main.getByRole('region', { name: 'Vueltas', exact: true });
  await expect(lapsRegion).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(stopwatchLink).toHaveAttribute('aria-current', 'page');

  const controls = main
    .getByRole('region', { name: 'Controles principales' })
    .getByRole('group', { name: 'Controles del cronómetro' });
  await expect(
    controls.getByRole('button', {
      name: 'Iniciar cronómetro',
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    controls.getByRole('button', { name: 'Reiniciar cronómetro' }),
  ).toBeDisabled();

  const columnCount = () =>
    lapsRegion.evaluate((element) => {
      const grid = element.parentElement;
      if (grid === null) {
        throw new Error('Stopwatch layout grid was not found.');
      }

      return getComputedStyle(grid)
        .gridTemplateColumns.trim()
        .split(/\s+/).length;
    });

  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await columnCount()).toBe(2);

  await page.setViewportSize({ width: 900, height: 900 });
  expect(await columnCount()).toBe(1);

  await page.goto('/stopwatch');
  await expect(
    main.getByRole('heading', { name: 'Cronómetro', exact: true }),
  ).toBeVisible();
  await expect(sidebar).toBeVisible();
});

test('controls laps and reset confirmation follow the Stopwatch state', async ({
  page,
}) => {
  await installFrozenClock(page);
  await page.goto('/stopwatch');

  const main = page.getByRole('main');
  const controls = main
    .getByRole('region', { name: 'Controles principales' })
    .getByRole('group', { name: 'Controles del cronómetro' });
  const lapsRegion = main.getByRole('region', { name: 'Vueltas', exact: true });
  const elapsed = main.getByRole('timer', {
    name: 'Tiempo transcurrido',
  });
  const table = lapsRegion.getByRole('table', {
    name: 'Vueltas registradas del cronómetro',
  });

  await expect(elapsed).toHaveText('00:00:00.00');
  await expect(
    lapsRegion.getByText('Aún no hay vueltas registradas.'),
  ).toBeVisible();

  const startButton = controls.getByRole('button', {
    name: 'Iniciar cronómetro',
    exact: true,
  });
  await expect(startButton).toBeEnabled();
  await startButton.focus();
  await page.keyboard.press('Enter');
  await expect(
    controls.getByRole('button', { name: 'Pausar cronómetro' }),
  ).toBeVisible();
  await expect(
    controls.getByRole('button', { name: 'Registrar vuelta' }),
  ).toBeEnabled();

  const segmentDurations = [1_000, 2_500, 750, 750, 2_500];

  for (const [index, durationMs] of segmentDurations.entries()) {
    await page.clock.runFor(durationMs);
    const lapButton = controls.getByRole('button', {
      name: 'Registrar vuelta',
    });

    if (index === 0) {
      await lapButton.focus();
      await page.keyboard.press('Space');
    } else {
      await lapButton.click();
    }

    await expect(table.getByRole('rowheader')).toHaveCount(index + 1);
  }

  await expect(elapsed).toHaveText('00:00:07.50');
  await expect(table.getByRole('rowheader')).toHaveText([
    'Vuelta 5',
    'Vuelta 4',
    'Vuelta 3',
    'Vuelta 2',
    'Vuelta 1',
  ]);

  const rowForLap = (number: number) =>
    table
      .getByRole('rowheader', {
        name: `Vuelta ${number}`,
        exact: true,
      })
      .locator('xpath=ancestor::tr');
  const fastestRow = rowForLap(3);
  const slowestRow = rowForLap(2);

  await expect(fastestRow).toContainText('Más rápido');
  await expect(slowestRow).toContainText('Más lento');
  await expect(table.getByText('Más rápido', { exact: true })).toHaveCount(1);
  await expect(table.getByText('Más lento', { exact: true })).toHaveCount(1);
  await expect(rowForLap(4)).not.toContainText('Más rápido');
  await expect(rowForLap(5)).not.toContainText('Más lento');
  await expect(fastestRow.getByRole('cell').nth(0)).toHaveText(
    '00:00:00.75',
  );
  await expect(fastestRow.getByRole('cell').nth(1)).toHaveText(
    '00:00:04.25',
  );
  await expect(slowestRow.getByRole('cell').nth(0)).toHaveText(
    '00:00:02.50',
  );
  await expect(slowestRow.getByRole('cell').nth(1)).toHaveText(
    '00:00:03.50',
  );

  const fastestColor = await fastestRow
    .getByRole('cell')
    .nth(0)
    .evaluate((cell) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--app-accent)';
      document.body.append(probe);
      const result = {
        actual: getComputedStyle(cell).color,
        accent: getComputedStyle(probe).color,
      };
      probe.remove();
      return result;
    });
  expect(fastestColor.actual).toBe(fastestColor.accent);

  const pauseButton = controls.getByRole('button', {
    name: 'Pausar cronómetro',
  });
  await pauseButton.focus();
  await page.keyboard.press('Enter');
  await expect(
    controls.getByRole('button', { name: 'Reanudar cronómetro' }),
  ).toBeVisible();
  await expect(
    controls.getByRole('button', { name: 'Reiniciar cronómetro' }),
  ).toBeEnabled();
  await expect(elapsed).toHaveText('00:00:07.50');

  await page.clock.runFor(30_000);
  await expect(elapsed).toHaveText('00:00:07.50');

  const resetButton = controls.getByRole('button', {
    name: 'Reiniciar cronómetro',
  });
  await resetButton.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', {
    name: '¿Reiniciar el cronómetro?',
  });
  const cancelButton = dialog.getByRole('button', { name: 'Cancelar' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleDescription(
    'Se restablecerá el tiempo transcurrido y se eliminarán todas las vueltas registradas.',
  );
  await expect(cancelButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(dialog).toBeHidden();
  await expect(resetButton).toBeFocused();
  await expect(elapsed).toHaveText('00:00:07.50');
  await expect(table.getByRole('rowheader')).toHaveCount(5);
  await expect(
    controls.getByRole('button', { name: 'Reanudar cronómetro' }),
  ).toBeVisible();

  await resetButton.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Reiniciar', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(dialog).toBeHidden();
  await page.clock.runFor(20);

  await expect(elapsed).toHaveText('00:00:00.00');
  await expect(
    controls.getByRole('button', {
      name: 'Iniciar cronómetro',
      exact: true,
    }),
  ).toBeFocused();
  await expect(
    controls.getByRole('button', { name: 'Reiniciar cronómetro' }),
  ).toBeDisabled();
  await expect(table).toHaveCount(0);
  await expect(
    lapsRegion.getByText('Aún no hay vueltas registradas.'),
  ).toBeVisible();
});

test('keeps Stopwatch running across route changes and reloads with its laps', async ({
  page,
}) => {
  await installFrozenClock(page);
  await page.goto('/stopwatch');

  const main = page.getByRole('main');
  const navigation = page.getByRole('navigation', {
    name: 'Navegación principal',
  });
  const controls = main
    .getByRole('region', { name: 'Controles principales' })
    .getByRole('group', { name: 'Controles del cronómetro' });
  const elapsed = main.getByRole('timer', {
    name: 'Tiempo transcurrido',
  });
  const lapsRegion = main.getByRole('region', { name: 'Vueltas', exact: true });
  const table = lapsRegion.getByRole('table', {
    name: 'Vueltas registradas del cronómetro',
  });

  await controls
    .getByRole('button', { name: 'Iniciar cronómetro', exact: true })
    .click();
  await expect(
    controls.getByRole('button', { name: 'Pausar cronómetro' }),
  ).toBeVisible();
  await page.clock.runFor(2_000);
  await controls.getByRole('button', { name: 'Registrar vuelta' }).click();
  await expect(table.getByRole('rowheader')).toHaveText(['Vuelta 1']);
  await expect(elapsed).toHaveText('00:00:02.00');

  await navigation.getByRole('link', { name: 'Reloj' }).click();
  await expect(page).toHaveURL(/\/clock$/);
  await page.clock.runFor(3_000);
  await navigation.getByRole('link', { name: 'Cronómetro' }).click();
  await expect(page).toHaveURL(/\/stopwatch$/);
  await expect(elapsed).toHaveText('00:00:05.00');
  await expect(table.getByRole('rowheader')).toHaveText(['Vuelta 1']);

  await page.reload();
  await expect(
    controls.getByRole('button', { name: 'Pausar cronómetro' }),
  ).toBeVisible();
  await expect(elapsed).toHaveText('00:00:05.00');
  await expect(table.getByRole('rowheader')).toHaveText(['Vuelta 1']);

  await page.clock.runFor(1_500);
  await controls.getByRole('button', { name: 'Registrar vuelta' }).click();
  await expect(elapsed).toHaveText('00:00:06.50');
  await expect(table.getByRole('rowheader')).toHaveText([
    'Vuelta 2',
    'Vuelta 1',
  ]);
  const secondLap = table
    .getByRole('rowheader', { name: 'Vuelta 2', exact: true })
    .locator('xpath=ancestor::tr');
  await expect(secondLap.getByRole('cell').nth(0)).toHaveText(
    '00:00:04.50',
  );
  await expect(secondLap.getByRole('cell').nth(1)).toHaveText(
    '00:00:06.50',
  );
});

test('keeps reset dialog keyboard-accessible under reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installFrozenClock(page);
  await page.goto('/stopwatch');

  const main = page.getByRole('main');
  const controls = main
    .getByRole('region', { name: 'Controles principales' })
    .getByRole('group', { name: 'Controles del cronómetro' });
  const elapsed = main.getByRole('timer', {
    name: 'Tiempo transcurrido',
  });

  await controls
    .getByRole('button', { name: 'Iniciar cronómetro', exact: true })
    .click();
  await page.clock.runFor(500);
  await controls.getByRole('button', { name: 'Pausar cronómetro' }).click();
  await expect(elapsed).toHaveText('00:00:00.50');
  await controls.getByRole('button', { name: 'Reiniciar cronómetro' }).click();

  const dialog = page.getByRole('dialog', {
    name: '¿Reiniciar el cronómetro?',
  });
  const cancelButton = dialog.getByRole('button', { name: 'Cancelar' });
  const confirmButton = dialog.getByRole('button', {
    name: 'Reiniciar',
    exact: true,
  });

  await expect(dialog).toBeVisible();
  await expect(cancelButton).toBeFocused();
  expect(
    await page.evaluate(() =>
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
  ).toBe(true);

  await page.keyboard.press('Tab');
  await expect(confirmButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(cancelButton).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
  await expect(
    controls.getByRole('button', { name: 'Reanudar cronómetro' }),
  ).toBeVisible();
  await expect(elapsed).toHaveText('00:00:00.50');
});
