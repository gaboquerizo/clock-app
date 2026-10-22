import { expect, test } from '@playwright/test';

test('accepts keyboard duration entry and explains invalid values', async ({
  page,
}) => {
  await page.goto('/tests/e2e/fixtures/timer-duration-input.html');

  const hours = page.getByRole('textbox', { name: 'Horas' });
  const minutes = page.getByRole('textbox', { name: 'Minutos' });
  const seconds = page.getByRole('textbox', { name: 'Segundos' });
  const output = page.getByTestId('duration-output');

  await hours.focus();
  await hours.press('Control+A');
  await hours.pressSequentially('01');
  await expect(output).toHaveText('3600000');

  await minutes.focus();
  await minutes.press('Control+A');
  await minutes.pressSequentially('60');
  await expect(page.getByText('Los minutos deben estar entre 00 y 59.')).toBeVisible();
  await expect(output).toHaveText('invalid');

  await minutes.focus();
  await minutes.press('Control+A');
  await minutes.pressSequentially('05');
  await seconds.focus();
  await seconds.press('Control+A');
  await seconds.pressSequentially('09');

  await expect(output).toHaveText('3909000');
  await expect(page.getByText('Los minutos deben estar entre 00 y 59.')).toHaveCount(0);
});
