import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/timer-dialog.html');
});

test('shows the create form without a delete action and emits valid input', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Abrir creación' }).click();

  const dialog = page.getByRole('dialog', { name: 'Añadir temporizador' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Etiqueta del temporizador (opcional)' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Añadir' }).click();
  await expect(
    dialog.getByText('Introduce una duración mayor que 00:00:00.'),
  ).toBeVisible();

  await dialog.getByRole('textbox', { name: 'Horas' }).fill('00');
  await dialog.getByRole('textbox', { name: 'Minutos' }).fill('02');
  await dialog.getByRole('textbox', { name: 'Segundos' }).fill('05');
  await dialog
    .getByRole('textbox', { name: 'Etiqueta del temporizador (opcional)' })
    .fill('Estudio');
  await dialog.getByRole('button', { name: 'Añadir' }).click();

  await expect(page.getByTestId('dialog-result')).toHaveText('submit:125000:Estudio');
  await expect(dialog).toBeVisible();
});

test('confirms deletion inside the edit dialog and restores edit values on cancel', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Abrir edición' }).click();

  const dialog = page.getByRole('dialog', { name: 'Editar temporizador' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Minutos' })).toHaveValue('01');
  await expect(dialog.getByRole('textbox', { name: 'Segundos' })).toHaveValue('30');
  await expect(dialog.getByRole('button', { name: 'Guardar' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByText('¿Eliminar este temporizador?')).toBeVisible();
  await expect(page.getByText(/El temporizador «Lectura»/)).toBeVisible();
  const confirmationDialog = page.getByRole('dialog', {
    name: 'Eliminar temporizador',
  });
  await expect(
    confirmationDialog.getByRole('button', { name: 'Cancelar' }),
  ).toBeFocused();

  await confirmationDialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog.getByRole('button', { name: 'Guardar' })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Minutos' })).toHaveValue('01');
  await expect(dialog.getByRole('textbox', { name: 'Segundos' })).toHaveValue('30');
  await expect(dialog.getByRole('textbox', { name: 'Horas' })).toBeFocused();

  await dialog.getByRole('button', { name: 'Eliminar' }).click();
  await page
    .getByRole('dialog', { name: 'Eliminar temporizador' })
    .getByRole('button', { name: 'Eliminar' })
    .click();
  await expect(page.getByTestId('dialog-result')).toHaveText('delete:timer-1');
});
