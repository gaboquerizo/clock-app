import { expect, test, type Locator, type Page } from '@playwright/test';

declare global {
  interface Window {
    __pomodoroAudioPlayCalls: number;
    __pomodoroNotificationCalls: number;
    __pomodoroPermissionRequestCalls: number;
  }
}

const referenceTime = new Date('2026-11-09T12:00:00.000Z');

async function installFrozenClock(page: Page) {
  await page.clock.install({ time: referenceTime });
  await page.clock.pauseAt(referenceTime);
}

async function installSilentAudio(page: Page) {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () {
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {};
  });
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Configuración' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Configuración de Pomodoro',
  });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillDurations(
  dialog: Locator,
  values: { focus: string; shortBreak: string; longBreak: string },
) {
  await dialog
    .getByRole('spinbutton', { name: 'Concentración' })
    .fill(values.focus);
  await dialog
    .getByRole('spinbutton', { name: 'Descanso corto' })
    .fill(values.shortBreak);
  await dialog
    .getByRole('spinbutton', { name: 'Descanso largo' })
    .fill(values.longBreak);
}

async function saveDurations(
  page: Page,
  values: { focus: string; shortBreak: string; longBreak: string },
) {
  const dialog = await openSettings(page);
  await fillDurations(dialog, values);
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
}

async function expectReadyBlock(
  page: Page,
  blockLabel: string,
  completedFocusCount: number,
  formattedRemaining: string,
) {
  const main = page.getByRole('main');

  await expect(main.getByRole('status')).toContainText(blockLabel);
  await expect(
    main.getByRole('timer', { name: 'Tiempo restante' }),
  ).toHaveText(formattedRemaining);
  await expect(
    main.getByLabel(
      `${completedFocusCount} de 4 concentraciones completadas`,
    ),
  ).toBeVisible();
  await expect(
    main.getByRole('button', {
      name: 'Iniciar bloque Pomodoro',
      exact: true,
    }),
  ).toBeEnabled();
}

test('controls blocks, retains cycle progress, and confirms cycle reset accessibly', async ({
  page,
}) => {
  await installFrozenClock(page);
  await installSilentAudio(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/pomodoro');

  const main = page.getByRole('main');
  const timer = main.getByRole('timer', { name: 'Tiempo restante' });
  const controls = main.getByRole('group', {
    name: 'Controles del bloque Pomodoro',
  });

  await expect(timer).toHaveText('25:00');
  await expect(
    main
      .getByRole('list', { name: 'Estado de las concentraciones' })
      .getByRole('listitem'),
  ).toHaveCount(4);
  await expect(
    main.getByLabel('0 de 4 concentraciones completadas'),
  ).toBeVisible();
  await saveDurations(page, { focus: '1', shortBreak: '1', longBreak: '1' });
  await expect(timer).toHaveText('01:00');

  const startButton = controls.getByRole('button', {
    name: 'Iniciar bloque Pomodoro',
    exact: true,
  });
  await startButton.focus();
  await page.keyboard.press('Enter');
  const pauseButton = controls.getByRole('button', {
    name: 'Pausar bloque Pomodoro',
  });
  await expect(pauseButton).toBeVisible();

  await page.clock.runFor(10_000);
  await expect(timer).toHaveText('00:50');
  await pauseButton.focus();
  await page.keyboard.press('Space');
  const resumeButton = controls.getByRole('button', {
    name: 'Reanudar bloque Pomodoro',
  });
  await expect(resumeButton).toBeVisible();
  await page.clock.runFor(20_000);
  await expect(timer).toHaveText('00:50');

  await resumeButton.focus();
  await page.keyboard.press('Enter');
  await page.clock.runFor(5_000);
  await expect(timer).toHaveText('00:45');
  await controls
    .getByRole('button', { name: 'Reiniciar bloque Pomodoro' })
    .click();
  await expectReadyBlock(page, 'Concentración', 0, '01:00');

  await controls
    .getByRole('button', {
      name: 'Iniciar bloque Pomodoro',
      exact: true,
    })
    .click();
  await page.clock.runFor(60_000);
  const completedFocusAlert = page.getByRole('dialog', {
    name: 'Concentración completada',
  });
  await expect(completedFocusAlert).toBeVisible();
  await expect(completedFocusAlert).toContainText(
    'Siguiente: descanso corto de 1 minuto.',
  );
  await expect(
    completedFocusAlert.getByRole('button', { name: 'Aceptar' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(completedFocusAlert).toBeHidden();
  await expectReadyBlock(page, 'Descanso corto', 1, '01:00');

  await controls
    .getByRole('button', {
      name: 'Iniciar bloque Pomodoro',
      exact: true,
    })
    .click();
  await page.clock.runFor(12_000);
  await controls
    .getByRole('button', { name: 'Reiniciar bloque Pomodoro' })
    .click();
  await expectReadyBlock(page, 'Descanso corto', 1, '01:00');

  const cycleResetButton = main.getByRole('button', {
    name: 'Reiniciar ciclo',
  });
  await cycleResetButton.click();
  const resetDialog = page.getByRole('dialog', {
    name: '¿Reiniciar el ciclo Pomodoro?',
  });
  const cancelButton = resetDialog.getByRole('button', { name: 'Cancelar' });
  await expect(resetDialog).toBeVisible();
  await expect(cancelButton).toBeFocused();
  await expect(resetDialog).toHaveAccessibleDescription(
    'Se descartará el progreso actual y el ciclo volverá a la primera concentración, en estado listo.',
  );
  expect(
    await page.evaluate(() =>
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(resetDialog).toBeHidden();
  await expect(cycleResetButton).toBeFocused();
  await expectReadyBlock(page, 'Descanso corto', 1, '01:00');

  await cycleResetButton.click();
  await resetDialog.getByRole('button', { name: 'Reiniciar ciclo' }).click();
  await expect(resetDialog).toBeHidden();
  await expectReadyBlock(page, 'Concentración', 0, '01:00');
});

test('validates, saves, cancels, and restores Pomodoro preferences', async ({
  page,
}) => {
  await installFrozenClock(page);
  await installSilentAudio(page);
  await page.goto('/pomodoro');

  const timer = page.getByRole('timer', { name: 'Tiempo restante' });
  await expect(timer).toHaveText('25:00');
  let dialog = await openSettings(page);
  const focusInput = dialog.getByRole('spinbutton', {
    name: 'Concentración',
  });
  const shortBreakInput = dialog.getByRole('spinbutton', {
    name: 'Descanso corto',
  });
  const longBreakInput = dialog.getByRole('spinbutton', {
    name: 'Descanso largo',
  });

  await expect(focusInput).toHaveValue('25');
  await expect(shortBreakInput).toHaveValue('5');
  await expect(longBreakInput).toHaveValue('15');
  await focusInput.fill('181');
  await expect(focusInput).toHaveAttribute('aria-invalid', 'true');
  await expect(
    dialog.getByText('Escribe un número entero entre 1 y 180 minutos.'),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Guardar' })).toBeDisabled();

  await fillDurations(dialog, {
    focus: '2',
    shortBreak: '3',
    longBreak: '4',
  });
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
  await expect(timer).toHaveText('02:00');

  dialog = await openSettings(page);
  await dialog.getByRole('spinbutton', { name: 'Concentración' }).fill('7');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Configuración' }),
  ).toBeFocused();

  await page.reload();
  await expect(timer).toHaveText('02:00');
  dialog = await openSettings(page);
  await expect(
    dialog.getByRole('spinbutton', { name: 'Concentración' }),
  ).toHaveValue('2');
  await expect(
    dialog.getByRole('spinbutton', { name: 'Descanso corto' }),
  ).toHaveValue('3');
  await expect(
    dialog.getByRole('spinbutton', { name: 'Descanso largo' }),
  ).toHaveValue('4');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
});

test('restores a running block across navigation and reload from its deadline', async ({
  page,
}) => {
  await installFrozenClock(page);
  await installSilentAudio(page);
  await page.goto('/pomodoro');
  await expect(
    page.getByRole('timer', { name: 'Tiempo restante' }),
  ).toHaveText('25:00');
  await saveDurations(page, { focus: '1', shortBreak: '1', longBreak: '1' });

  await page
      .getByRole('button', {
        name: 'Iniciar bloque Pomodoro',
        exact: true,
      })
    .click();
  await page.clock.runFor(15_000);
  await page.getByRole('link', { name: 'Reloj' }).click();
  await expect(page).toHaveURL(/\/clock$/);
  await page.clock.runFor(10_000);
  await page.getByRole('link', { name: 'Pomodoro' }).click();
  await expect(page).toHaveURL(/\/pomodoro$/);
  let timer = page.getByRole('timer', { name: 'Tiempo restante' });
  await expect(timer).toHaveText('00:35');
  await expect(
    page.getByRole('button', { name: 'Pausar bloque Pomodoro' }),
  ).toBeVisible();

  await page.reload();
  timer = page.getByRole('timer', { name: 'Tiempo restante' });
  await expect(timer).toHaveText('00:35');
  await expect(
    page.getByRole('button', { name: 'Pausar bloque Pomodoro' }),
  ).toBeVisible();
  await page.clock.runFor(5_000);
  await expect(timer).toHaveText('00:30');
});

test('runs the full cycle manually and supports the global start-next action from another route', async ({
  page,
}) => {
  await installFrozenClock(page);
  await installSilentAudio(page);
  await page.goto('/pomodoro');
  await expect(
    page.getByRole('timer', { name: 'Tiempo restante' }),
  ).toHaveText('25:00');
  await saveDurations(page, { focus: '1', shortBreak: '1', longBreak: '1' });

  await page
    .getByRole('button', {
      name: 'Iniciar bloque Pomodoro',
      exact: true,
    })
    .click();
  await page.getByRole('link', { name: 'Reloj' }).click();
  await expect(page).toHaveURL(/\/clock$/);
  await page.clock.runFor(60_000);

  const firstAlert = page.getByRole('dialog', {
    name: 'Concentración completada',
  });
  await expect(firstAlert).toBeVisible();
  await expect(firstAlert).toContainText(
    'Siguiente: descanso corto de 1 minuto.',
  );
  const firstAccept = firstAlert.getByRole('button', { name: 'Aceptar' });
  const startNext = firstAlert.getByRole('button', {
    name: 'Iniciar siguiente',
  });
  await expect(firstAccept).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(startNext).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/pomodoro$/);
  await expect(firstAlert).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Pausar bloque Pomodoro' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Descanso corto');
  await expect(
    page.getByLabel('1 de 4 concentraciones completadas'),
  ).toBeVisible();

  const laterTransitions = [
    {
      completedTitle: 'Descanso corto completado',
      nextDescription: 'Siguiente: concentración de 1 minuto.',
      nextBlock: 'Concentración',
      focusCount: 1,
    },
    {
      completedTitle: 'Concentración completada',
      nextDescription: 'Siguiente: descanso corto de 1 minuto.',
      nextBlock: 'Descanso corto',
      focusCount: 2,
    },
    {
      completedTitle: 'Descanso corto completado',
      nextDescription: 'Siguiente: concentración de 1 minuto.',
      nextBlock: 'Concentración',
      focusCount: 2,
    },
    {
      completedTitle: 'Concentración completada',
      nextDescription: 'Siguiente: descanso corto de 1 minuto.',
      nextBlock: 'Descanso corto',
      focusCount: 3,
    },
    {
      completedTitle: 'Descanso corto completado',
      nextDescription: 'Siguiente: concentración de 1 minuto.',
      nextBlock: 'Concentración',
      focusCount: 3,
    },
    {
      completedTitle: 'Concentración completada',
      nextDescription: 'Siguiente: descanso largo de 1 minuto.',
      nextBlock: 'Descanso largo',
      focusCount: 4,
    },
    {
      completedTitle: 'Descanso largo completado',
      nextDescription: 'Siguiente: concentración de 1 minuto.',
      nextBlock: 'Concentración',
      focusCount: 0,
    },
  ];

  for (const [index, transition] of laterTransitions.entries()) {
    await page.clock.runFor(60_000);
    const alert = page.getByRole('dialog', {
      name: transition.completedTitle,
    });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(transition.nextDescription);
    await expect(
      alert.getByRole('button', { name: 'Aceptar' }),
    ).toBeFocused();

    await page.keyboard.press(index === 0 ? 'Space' : 'Enter');
    await expect(alert).toBeHidden();
    await expectReadyBlock(
      page,
      transition.nextBlock,
      transition.focusCount,
      '01:00',
    );

    if (index < laterTransitions.length - 1) {
      await page
        .getByRole('button', {
          name: 'Iniciar bloque Pomodoro',
          exact: true,
        })
        .click();
    }
  }
});

test('shows recovered completion visually without sound or a late browser notification', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__pomodoroAudioPlayCalls = 0;
    window.__pomodoroNotificationCalls = 0;
    window.__pomodoroPermissionRequestCalls = 0;

    HTMLMediaElement.prototype.play = function () {
      window.__pomodoroAudioPlayCalls += 1;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {};

    class GrantedNotification {
      static get permission(): NotificationPermission {
        return 'granted';
      }

      static requestPermission(): Promise<NotificationPermission> {
        window.__pomodoroPermissionRequestCalls += 1;
        return Promise.resolve('granted');
      }

      constructor(_title: string, _options?: NotificationOptions) {
        window.__pomodoroNotificationCalls += 1;
      }
    }

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: GrantedNotification,
    });
  });
  await installFrozenClock(page);
  await page.goto('/pomodoro');
  await expect(
    page.getByRole('timer', { name: 'Tiempo restante' }),
  ).toHaveText('25:00');

  const scheduledAt = referenceTime.getTime() - 1_000;
  const expiredRecord = {
    id: 'current',
    cycleId: 'recovered-cycle',
    status: 'running',
    completedFocusCount: 1,
    currentBlock: {
      id: 'recovered-focus',
      type: 'focus',
      durationMs: 60_000,
    },
    startedAt: scheduledAt - 60_000,
    endsAt: scheduledAt,
    lastProcessedCompletion: null,
  };

  await page.evaluate(async (record) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('clock-app-pomodoro', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('pomodoro-cycle', 'readwrite');
      transaction.objectStore('pomodoro-cycle').put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, expiredRecord);

  await page.reload();
  const recoveryAlert = page.getByRole('dialog', {
    name: 'Concentración completada',
  });
  await expect(recoveryAlert).toBeVisible();
  await expect(recoveryAlert).toContainText(
    'Siguiente: descanso corto de 5 minutos.',
  );
  await expect(
    recoveryAlert.getByRole('button', { name: 'Aceptar' }),
  ).toBeFocused();
  await expect(
    page.evaluate(() => ({
      audio: window.__pomodoroAudioPlayCalls,
      notifications: window.__pomodoroNotificationCalls,
      permissionRequests: window.__pomodoroPermissionRequestCalls,
    })),
  ).resolves.toEqual({
    audio: 0,
    notifications: 0,
    permissionRequests: 0,
  });

  await page.keyboard.press('Escape');
  await expect(recoveryAlert).toBeHidden();
  await expectReadyBlock(page, 'Descanso corto', 2, '05:00');

  await page.reload();
  await expect(
    page.getByRole('dialog', { name: 'Concentración completada' }),
  ).toHaveCount(0);
  await expectReadyBlock(page, 'Descanso corto', 2, '05:00');
});
