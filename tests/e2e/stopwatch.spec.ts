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
  await expect(sidebar).toBeVisible();
  await expect(
    navigation.getByRole('link', { name: 'Cronómetro' }),
  ).toHaveClass(/app-sidebar__menu-link--active/);

  await page.goto('/stopwatch');
  await expect(
    main.getByRole('heading', { name: 'Cronómetro', exact: true }),
  ).toBeVisible();
  await expect(sidebar).toBeVisible();
});
