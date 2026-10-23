import { expect, test } from '@playwright/test';

test('canceling timer creation leaves the collection empty', async ({ page }) => {
  await page.goto('/timers');

  const emptyState = page.getByRole('region', {
    name: 'No tienes temporizadores todavía.',
  });
  await expect(emptyState).toBeVisible();
  await emptyState.getByRole('button', { name: 'Añadir temporizador' }).click();

  const dialog = page.getByRole('dialog', { name: 'Añadir temporizador' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Horas' }).fill('00');
  await dialog.getByRole('textbox', { name: 'Minutos' }).fill('03');
  await dialog.getByRole('textbox', { name: 'Segundos' }).fill('00');
  await dialog
    .getByRole('textbox', { name: 'Etiqueta del temporizador (opcional)' })
    .fill('Sin confirmar');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();

  await expect(dialog).toBeHidden();
  await expect(emptyState).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Temporizadores configurados' }),
  ).toHaveCount(0);
});

test('creates multiple ready timers and restores their duration and label after reload', async ({
  page,
}) => {
  await page.goto('/timers');

  const emptyState = page.getByRole('region', {
    name: 'No tienes temporizadores todavía.',
  });
  await expect(emptyState).toBeVisible();
  await emptyState.getByRole('button', { name: 'Añadir temporizador' }).click();

  const dialog = page.getByRole('dialog', { name: 'Añadir temporizador' });
  await dialog.getByRole('textbox', { name: 'Horas' }).fill('00');
  await dialog.getByRole('textbox', { name: 'Minutos' }).fill('02');
  await dialog.getByRole('textbox', { name: 'Segundos' }).fill('05');
  await dialog
    .getByRole('textbox', { name: 'Etiqueta del temporizador (opcional)' })
    .fill('Estudio');
  await dialog.getByRole('button', { name: 'Añadir' }).click();

  await expect(dialog).toBeHidden();
  let list = page.getByRole('list', { name: 'Temporizadores configurados' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list.getByRole('article', { name: /Estudio, Listo/ })).toContainText(
    '00:02:05',
  );

  await page.getByRole('button', { name: 'Añadir temporizador' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Horas' }).fill('00');
  await dialog.getByRole('textbox', { name: 'Minutos' }).fill('00');
  await dialog.getByRole('textbox', { name: 'Segundos' }).fill('30');
  await dialog.getByRole('button', { name: 'Añadir' }).click();

  await expect(dialog).toBeHidden();
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByRole('article', { name: /Temporizador, Listo/ })).toContainText(
    '00:00:30',
  );

  await page.reload();
  list = page.getByRole('list', { name: 'Temporizadores configurados' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByRole('article', { name: /Estudio, Listo/ })).toContainText(
    '00:02:05',
  );
  await expect(list.getByRole('article', { name: /Temporizador, Listo/ })).toContainText(
    '00:00:30',
  );
});
