import { expect, test } from '@playwright/test';

test('edits a timer without duplicating it and persists the approved reset state', async ({
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
  await createDialog.getByRole('textbox', { name: 'Horas' }).fill('00');
  await createDialog.getByRole('textbox', { name: 'Minutos' }).fill('02');
  await createDialog.getByRole('textbox', { name: 'Segundos' }).fill('00');
  await createDialog
    .getByRole('textbox', { name: 'Etiqueta del temporizador (opcional)' })
    .fill('Lectura');
  await createDialog.getByRole('button', { name: 'Añadir' }).click();
  await expect(createDialog).toBeHidden();

  const list = page.getByRole('list', { name: 'Temporizadores configurados' });
  const card = list.getByRole('article', { name: 'Lectura, Listo' });
  await expect(card).toBeVisible();
  const timerId = await card.getAttribute('data-timer-id');
  if (timerId === null) throw new Error('Expected the timer to have an identity.');

  const editButton = page.getByRole('button', {
    name: 'Editar temporizador Lectura',
  });
  await editButton.focus();
  await editButton.press('Enter');

  const editDialog = page.getByRole('dialog', { name: 'Editar temporizador' });
  await expect(editDialog).toBeVisible();
  await expect(editDialog.getByRole('textbox', { name: 'Horas' })).toHaveValue(
    '00',
  );
  await expect(editDialog.getByRole('textbox', { name: 'Minutos' })).toHaveValue(
    '02',
  );
  await expect(editDialog.getByRole('textbox', { name: 'Segundos' })).toHaveValue(
    '00',
  );
  await expect(
    editDialog.getByRole('textbox', {
      name: 'Etiqueta del temporizador (opcional)',
    }),
  ).toHaveValue('Lectura');

  await editDialog.getByRole('textbox', { name: 'Minutos' }).fill('03');
  await editDialog.getByRole('textbox', { name: 'Segundos' }).fill('10');
  await editDialog
    .getByRole('textbox', {
      name: 'Etiqueta del temporizador (opcional)',
    })
    .fill('Repaso');
  await editDialog.getByRole('button', { name: 'Guardar' }).click();

  await expect(editDialog).toBeHidden();
  await expect(list.getByRole('listitem')).toHaveCount(1);
  const updatedCard = list.getByRole('article', { name: 'Repaso, Listo' });
  await expect(updatedCard).toContainText('00:03:10');
  await expect(updatedCard).toHaveAttribute('data-timer-id', timerId);

  const updatedEditButton = page.getByRole('button', {
    name: 'Editar temporizador Repaso',
  });
  await updatedEditButton.focus();
  await updatedEditButton.press('Enter');
  await expect(editDialog).toBeVisible();
  await editDialog
    .getByRole('textbox', {
      name: 'Etiqueta del temporizador (opcional)',
    })
    .fill('Sin guardar');
  await page.keyboard.press('Escape');

  await expect(editDialog).toBeHidden();
  await expect(updatedEditButton).toBeFocused();
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(updatedCard).toContainText('Repaso');
  await expect(updatedCard).not.toContainText('Sin guardar');

  await page.reload();
  const restoredList = page.getByRole('list', {
    name: 'Temporizadores configurados',
  });
  const restoredCard = restoredList.getByRole('article', {
    name: 'Repaso, Listo',
  });
  await expect(restoredList.getByRole('listitem')).toHaveCount(1);
  await expect(restoredCard).toContainText('00:03:10');
  await expect(restoredCard).toHaveAttribute('data-timer-id', timerId);
});
