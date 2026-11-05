import { expect, test } from '@playwright/test';

test('navigates to Pomodoro while keeping the app shell and existing routes available', async ({
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

  await navigation.getByRole('link', { name: 'Pomodoro' }).click();
  await expect(page).toHaveURL(/\/pomodoro$/);
  await expect(
    main.getByRole('heading', { name: 'Pomodoro', exact: true }),
  ).toBeVisible();
  await expect(
    main.getByRole('region', { name: 'Tiempo restante', exact: true }),
  ).toBeVisible();
  await expect(
    main.getByRole('region', { name: 'Controles', exact: true }),
  ).toBeVisible();
  const cycleRegion = main.getByRole('region', {
    name: 'Progreso del ciclo',
    exact: true,
  });
  await expect(cycleRegion).toBeVisible();
  await expect(
    main.getByRole('button', { name: 'Configuración' }),
  ).toBeDisabled();
  await expect(
    main.getByRole('button', { name: 'Reiniciar ciclo' }),
  ).toBeDisabled();
  await expect(
    navigation.getByRole('link', { name: 'Pomodoro' }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(sidebar).toBeVisible();

  const columnCount = () =>
    cycleRegion.evaluate((element) => {
      const grid = element.parentElement;
      if (grid === null) {
        throw new Error('Pomodoro layout grid was not found.');
      }

      return getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)
        .length;
    });

  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await columnCount()).toBe(2);

  await page.setViewportSize({ width: 768, height: 900 });
  expect(await columnCount()).toBe(1);

  await page.setViewportSize({ width: 1280, height: 800 });
  await navigation.getByRole('link', { name: 'Cronómetro' }).click();
  await expect(page).toHaveURL(/\/stopwatch$/);
  await expect(
    main.getByRole('heading', { name: 'Cronómetro', exact: true }),
  ).toBeVisible();
  await expect(sidebar).toBeVisible();

  await navigation.getByRole('link', { name: 'Reloj' }).click();
  await expect(page).toHaveURL(/\/clock$/);
  await expect(main.getByRole('heading', { name: 'Reloj' })).toBeVisible();
  await expect(sidebar).toBeVisible();
});
