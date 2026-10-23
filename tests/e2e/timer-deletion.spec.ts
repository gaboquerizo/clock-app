import { expect, test } from '@playwright/test';

test('cancels deletion in the edit dialog, then removes the timer permanently', async ({
  page,
}) => {
  await page.goto('/timers');
  await page
    .getByRole('region', { name: 'No tienes temporizadores todavía.' })
    .getByRole('button', { name: 'Añadir temporizador' })
    .click();

  const createDialog = page.getByRole('dialog', {
    name: 'Añadir temporizador',
  });
  await createDialog.getByRole('textbox', { name: 'Minutos' }).fill('02');
  await createDialog
    .getByRole('textbox', {
      name: 'Etiqueta del temporizador (opcional)',
    })
    .fill('Sprint');
  await createDialog.getByRole('button', { name: 'Añadir' }).click();
  await expect(createDialog).toBeHidden();

  const list = page.getByRole('list', { name: 'Temporizadores configurados' });
  const card = list.getByRole('article', { name: 'Sprint, Listo' });
  await expect(card).toBeVisible();

  const editButton = page.getByRole('button', {
    name: 'Editar temporizador Sprint',
  });
  await editButton.click();

  const editDialog = page.getByRole('dialog', { name: 'Editar temporizador' });
  await editDialog.getByRole('textbox', { name: 'Minutos' }).fill('03');
  await editDialog
    .getByRole('textbox', {
      name: 'Etiqueta del temporizador (opcional)',
    })
    .fill('Cambios sin guardar');
  await editDialog.getByRole('button', { name: 'Eliminar' }).click();

  const confirmationDialog = page.getByRole('dialog', {
    name: 'Eliminar temporizador',
  });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(
    confirmationDialog.getByText('El temporizador «Sprint» se eliminará cuando se confirme.'),
  ).toBeVisible();
  await expect(
    confirmationDialog.getByRole('button', { name: 'Cancelar' }),
  ).toBeFocused();

  await confirmationDialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(editDialog.getByRole('textbox', { name: 'Horas' })).toBeFocused();
  await expect(editDialog.getByRole('textbox', { name: 'Minutos' })).toHaveValue(
    '03',
  );
  await expect(
    editDialog.getByRole('textbox', {
      name: 'Etiqueta del temporizador (opcional)',
    }),
  ).toHaveValue('Cambios sin guardar');
  await expect(list.getByRole('listitem')).toHaveCount(1);

  await editDialog.getByRole('button', { name: 'Eliminar' }).click();
  await page
    .getByRole('dialog', { name: 'Eliminar temporizador' })
    .getByRole('button', { name: 'Eliminar' })
    .click();

  await expect(editDialog).toBeHidden();
  await expect(
    page.getByRole('region', { name: 'No tienes temporizadores todavía.' }),
  ).toBeVisible();
  const addTimerButton = page.getByRole('button', {
    name: 'Añadir temporizador',
  });
  await expect(addTimerButton).toBeFocused();

  await page.reload();
  await expect(
    page.getByRole('region', { name: 'No tienes temporizadores todavía.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Temporizadores configurados' }),
  ).toHaveCount(0);
});
