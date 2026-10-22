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
