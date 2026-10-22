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
  await expect(main.getByRole('heading', { name: 'Temporizador' })).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(
    navigation.getByRole('link', { name: 'Temporizador' }),
  ).toHaveClass(/app-sidebar__menu-link--active/);

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
