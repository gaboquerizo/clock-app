import { expect, test } from '@playwright/test';

test('navigates to Stopwatch from the sidebar and loads its route directly', async ({
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

  await navigation.getByRole('link', { name: 'Cronómetro' }).click();
  await expect(page).toHaveURL(/\/stopwatch$/);
  await expect(
    main.getByRole('heading', { name: 'Cronómetro', exact: true }),
  ).toBeVisible();
  for (const regionName of [
    'Tiempo transcurrido',
    'Controles principales',
    'Registro de vueltas',
  ]) {
    await expect(
      main.getByRole('region', { name: regionName, exact: true }),
    ).toBeVisible();
  }
  await expect(sidebar).toBeVisible();
  await expect(
    navigation.getByRole('link', { name: 'Cronómetro' }),
  ).toHaveClass(/app-sidebar__menu-link--active/);

  const stopwatchContent = main.locator('.stopwatch-view__content');
  await page.setViewportSize({ width: 1280, height: 800 });
  const desktopColumns = await stopwatchContent.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  );
  expect(desktopColumns.trim().split(/\s+/)).toHaveLength(2);

  await page.setViewportSize({ width: 900, height: 900 });
  const tabletColumns = await stopwatchContent.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  );
  expect(tabletColumns.trim().split(/\s+/)).toHaveLength(1);

  await page.goto('/stopwatch');
  await expect(
    main.getByRole('heading', { name: 'Cronómetro', exact: true }),
  ).toBeVisible();
  await expect(sidebar).toBeVisible();
});
