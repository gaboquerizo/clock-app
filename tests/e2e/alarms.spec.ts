import { expect, test, type Page } from '@playwright/test';

const fixedLocalTime = new Date('2026-10-18T06:00:00-05:00');

declare global {
  interface Window {
    __notificationConstructorCount: number;
    __notificationPermissionRequestCount: number;
  }
}

async function openAlarms(page: Page, time = fixedLocalTime) {
  await page.clock.install({ time });
  await page.goto('/alarms');
  await expect(
    page.getByRole('heading', { name: 'Alarma', exact: true }),
  ).toBeVisible();
}

async function createAlarmFromUi(
  page: Page,
  time: string,
  label: string,
  fromEmptyState = false,
) {
  const addButton = fromEmptyState
    ? page
        .getByRole('region', { name: 'No tienes alarmas todavía.' })
        .getByRole('button', { name: 'Añadir Alarma' })
    : page.getByRole('button', { name: 'Añadir Alarma' }).first();

  await addButton.click();

  const dialog = page.getByRole('dialog', { name: 'Añadir alarma' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('header')).toHaveCount(0);
  await dialog.getByRole('spinbutton', { name: 'Horas' }).fill(time.slice(0, 2));
  await dialog
    .getByRole('spinbutton', { name: 'Minutos' })
    .fill(time.slice(3, 5));
  await dialog
    .getByRole('textbox', { name: 'Etiqueta de la alarma' })
    .fill(label);
  await dialog.getByRole('button', { name: 'Añadir', exact: true }).click();

  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: `Editar alarma ${time}, ${label || 'Alarma'}` }),
  ).toBeVisible();
  await expect(
    page
      .locator('.alarms-view__header')
      .getByRole('button', { name: 'Añadir Alarma' }),
  ).toBeVisible();
}

async function createAlarmAndTrigger(page: Page) {
  await openAlarms(page);
  await createAlarmFromUi(page, '06:01', 'Wake up');
  await page.getByRole('link', { name: 'Reloj' }).click();
  await expect(page).toHaveURL(/\/clock$/);
  await page.clock.fastForward('01:00');

  const dialog = page.getByRole('dialog', { name: 'Alarma · 06:01' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('Alarms', () => {
  test('redirects to Clock, navigates to Alarms, and opens creation from the empty state', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/clock$/);

    const navigation = page.getByRole('navigation', {
      name: 'Navegación principal',
    });
    await navigation.getByRole('link', { name: 'Alarma' }).click();
    await expect(page).toHaveURL(/\/alarms$/);

    const emptyState = page.getByRole('region', {
      name: 'No tienes alarmas todavía.',
    });
    await expect(emptyState).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Añadir Alarma' }),
    ).toHaveCount(1);
    await emptyState.getByRole('button', { name: 'Añadir Alarma' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Añadir alarma' });
    await expect(createDialog).toBeVisible();
    await expect(
      createDialog.getByRole('button', { name: 'Cancelar', exact: true }),
    ).toBeVisible();
  });

  test('creates, edits, toggles, persists, and deletes an alarm in one dialog', async ({
    page,
  }) => {
    await openAlarms(page);
    await createAlarmFromUi(page, '07:30', 'Wake up');

    await page.reload();
    const originalCard = page.getByRole('button', {
      name: 'Editar alarma 07:30, Wake up',
    });
    await expect(originalCard).toBeVisible();

    await originalCard.click();
    const editDialog = page.getByRole('dialog', { name: 'Editar alarma' });
    await expect(editDialog.locator('header')).toHaveCount(0);
    await expect(
      editDialog.getByRole('button', { name: 'Eliminar', exact: true }),
    ).toBeVisible();
    await expect(
      editDialog.getByRole('button', { name: 'Guardar', exact: true }),
    ).toBeVisible();
    await expect(
      editDialog.getByRole('button', { name: 'Cancelar', exact: true }),
    ).toHaveCount(0);
    await editDialog.getByRole('spinbutton', { name: 'Minutos' }).fill('45');
    await editDialog
      .getByRole('textbox', { name: 'Etiqueta de la alarma' })
      .fill('Morning work');
    await editDialog.getByRole('button', { name: 'Guardar' }).click();

    const editedCardName = 'Editar alarma 07:45, Morning work';
    const editedCard = page.getByRole('button', { name: editedCardName });
    await expect(editedCard).toBeVisible();

    const disableSwitch = page.getByRole('switch', {
      name: 'Desactivar alarma 07:45',
    });
    await disableSwitch.click();
    await expect(
      page.getByRole('switch', { name: 'Activar alarma 07:45' }),
    ).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(editedCard).toContainText('Desactivada');

    await page.reload();
    await expect(editedCard).toBeVisible();
    const enableSwitch = page.getByRole('switch', {
      name: 'Activar alarma 07:45',
    });
    await expect(enableSwitch).toHaveAttribute('aria-checked', 'false');
    await enableSwitch.click();
    await expect(
      page.getByRole('switch', { name: 'Desactivar alarma 07:45' }),
    ).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await editedCard.click();
    const reopenedDialog = page.getByRole('dialog', { name: 'Editar alarma' });
    await reopenedDialog
      .getByRole('textbox', { name: 'Etiqueta de la alarma' })
      .fill('Draft label');
    await reopenedDialog
      .getByRole('button', { name: 'Eliminar', exact: true })
      .click();

    const confirmDialog = page.getByRole('dialog', {
      name: 'Eliminar alarma',
    });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.locator('header')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(confirmDialog.getByText('¿Eliminar esta alarma?')).toBeVisible();
    await expect(confirmDialog).toContainText(
      'La alarma «Morning work» se eliminará cuando se confirme.',
    );
    await confirmDialog.getByRole('button', { name: 'Cancelar' }).click();

    const restoredEditDialog = page.getByRole('dialog', {
      name: 'Editar alarma',
    });
    await expect(
      restoredEditDialog.getByRole('textbox', {
        name: 'Etiqueta de la alarma',
      }),
    ).toHaveValue('Draft label');
    await expect(editedCard).toBeVisible();

    await restoredEditDialog
      .getByRole('button', { name: 'Eliminar', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: 'Eliminar alarma' })
      .getByRole('button', { name: 'Eliminar', exact: true })
      .click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'No tienes alarmas todavía.' }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('region', { name: 'No tienes alarmas todavía.' }),
    ).toBeVisible();
  });

  test('orders active alarms by their next activation time', async ({ page }) => {
    await openAlarms(page);
    await createAlarmFromUi(page, '07:30', 'Later alarm');
    await createAlarmFromUi(page, '07:00', 'Sooner alarm');

    const alarmList = page.getByRole('list', {
      name: 'Alarmas configuradas',
    });
    const times = await alarmList
      .getByRole('listitem')
      .evaluateAll((items) =>
        items.map((item) => item.querySelector('time')?.textContent),
      );

    expect(times).toEqual(['07:00', '07:30']);
  });

  test('keeps the scheduler alive across navigation and focuses the global alert', async ({
    page,
  }) => {
    const alertDialog = await createAlarmAndTrigger(page);
    await expect(alertDialog.locator('header')).toBeVisible();
    await expect(
      alertDialog.getByRole('heading', { name: 'Alarma · 06:01' }),
    ).toBeVisible();
    const acceptButton = alertDialog.getByRole('button', { name: 'Aceptar' });

    await expect(acceptButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(alertDialog).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Reloj' })).toBeFocused();
  });

  test('accepts the global alert with Space', async ({ page }) => {
    const alertDialog = await createAlarmAndTrigger(page);
    await expect(
      alertDialog.getByRole('button', { name: 'Aceptar' }),
    ).toBeFocused();

    await page.keyboard.press('Space');
    await expect(alertDialog).not.toBeVisible();
  });

  test('accepts the global alert with Escape', async ({ page }) => {
    const alertDialog = await createAlarmAndTrigger(page);

    await page.keyboard.press('Escape');
    await expect(alertDialog).not.toBeVisible();
  });

  test('keeps confirmation keyboard interactions available during the panel transition', async ({
    page,
  }) => {
    await openAlarms(page);
    await createAlarmFromUi(page, '07:30', 'Focus test');
    await page
      .getByRole('button', { name: 'Editar alarma 07:30, Focus test' })
      .click();

    const editDialog = page.getByRole('dialog', { name: 'Editar alarma' });
    await editDialog
      .getByRole('textbox', { name: 'Etiqueta de la alarma' })
      .fill('Draft value');
    await editDialog
      .getByRole('button', { name: 'Eliminar', exact: true })
      .focus();
    await page.keyboard.press('Enter');

    const confirmDialog = page.getByRole('dialog', {
      name: 'Eliminar alarma',
    });
    await expect(confirmDialog).toBeVisible();
    const confirmationSwitcher = confirmDialog.locator(
      '.alarm-dialog__content-switcher',
    );
    const confirmationContent = confirmationSwitcher.locator(
      '.alarm-dialog__confirmation',
    );
    await expect
      .poll(async () => {
        const [containerHeight, contentHeight] = await Promise.all([
          confirmationSwitcher.evaluate((element) =>
            element.getBoundingClientRect().height,
          ),
          confirmationContent.evaluate((element) => element.scrollHeight),
        ]);

        return Math.abs(containerHeight - contentHeight);
      })
      .toBeLessThanOrEqual(1);
    const [confirmationContainerHeight, confirmationContentHeight] =
      await Promise.all([
        confirmationSwitcher.evaluate((element) =>
          element.getBoundingClientRect().height,
        ),
        confirmationContent.evaluate((element) => element.scrollHeight),
      ]);
    expect(
      Math.abs(confirmationContainerHeight - confirmationContentHeight),
    ).toBeLessThanOrEqual(1);

    const cancelButton = confirmDialog.getByRole('button', {
      name: 'Cancelar',
    });
    await expect(cancelButton).toBeFocused();
    const focusIndicator = await cancelButton.evaluate((element) => {
      const styles = getComputedStyle(element);

      return {
        matchesFocusVisible: element.matches(':focus-visible'),
        outlineStyle: styles.outlineStyle,
        outlineWidth: Number.parseFloat(styles.outlineWidth),
      };
    });
    expect(focusIndicator.matchesFocusVisible).toBe(true);
    expect(focusIndicator.outlineStyle).not.toBe('none');
    expect(focusIndicator.outlineWidth).toBeGreaterThan(0);
    await page.keyboard.press('Enter');

    const restoredDialog = page.getByRole('dialog', { name: 'Editar alarma' });
    await expect(restoredDialog).toBeVisible();
    await expect(
      restoredDialog.getByRole('textbox', {
        name: 'Etiqueta de la alarma',
      }),
    ).toHaveValue('Draft value');
  });

  test('disables confirmation panel motion when reduced motion is requested', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openAlarms(page);
    await createAlarmFromUi(page, '07:30', 'Reduced motion');
    await page
      .getByRole('button', { name: 'Editar alarma 07:30, Reduced motion' })
      .click();

    const editDialog = page.getByRole('dialog', { name: 'Editar alarma' });
    await editDialog
      .getByRole('button', { name: 'Eliminar', exact: true })
      .click();

    const confirmDialog = page.getByRole('dialog', {
      name: 'Eliminar alarma',
    });
    await expect(confirmDialog.getByRole('heading', {
      name: '¿Eliminar esta alarma?',
    })).toBeVisible();
    const transitionDuration = await confirmDialog
      .locator('[data-open="true"]')
      .evaluate((element) => getComputedStyle(element).transitionDuration);

    expect(transitionDuration.split(',').every((duration) =>
      Number.parseFloat(duration.trim()) === 0,
    )).toBe(true);
  });

  test('continues showing the in-app alarm alert when browser notifications are denied', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__notificationConstructorCount = 0;
      window.__notificationPermissionRequestCount = 0;
      class DeniedNotification {
        static get permission(): NotificationPermission {
          return 'denied';
        }

        static requestPermission(): Promise<NotificationPermission> {
          window.__notificationPermissionRequestCount += 1;
          return Promise.resolve('denied');
        }

        constructor(_title: string, _options?: NotificationOptions) {
          window.__notificationConstructorCount += 1;
        }
      }

      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: DeniedNotification,
      });
    });

    await openAlarms(page);
    await expect(
      page.getByText(
        'El navegador bloqueó las notificaciones. Puedes habilitarlas desde los permisos de este sitio; las alarmas seguirán mostrando avisos en Clock App y reproduciendo sonido cuando corresponda.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Activar notificaciones' }),
    ).toHaveCount(0);

    await createAlarmFromUi(page, '06:01', 'Wake up');
    await page.getByRole('link', { name: 'Reloj' }).click();
    await expect(page).toHaveURL(/\/clock$/);
    await page.clock.fastForward('01:00');

    const alertDialog = page.getByRole('dialog', { name: 'Alarma · 06:01' });
    await expect(alertDialog).toBeVisible();
    await expect(
      page.evaluate(() => window.__notificationPermissionRequestCount),
    ).resolves.toBe(0);
    await expect(
      page.evaluate(() => window.__notificationConstructorCount),
    ).resolves.toBe(0);
  });
});
