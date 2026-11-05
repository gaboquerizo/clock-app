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
    navigation.getByRole('link', { name: 'Pomodoro' }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(sidebar).toBeVisible();

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
