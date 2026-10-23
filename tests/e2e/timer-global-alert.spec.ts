import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __timerAudioPlayCalls: number;
    __timerAudioPauseCalls: number;
    __notificationConstructorCount: number;
    __notificationPermissionRequestCount: number;
  }
}

async function seedRunningTimer(
  page: Page,
  id: string,
  label: string,
  durationMs: number,
) {
  await page.evaluate(
    async ({ id: timerId, label: timerLabel, durationMs: duration }) => {
      const repositoryModuleUrl =
        '/src/features/timers/storage/timer-repository.ts';
      const domainModuleUrl = '/src/features/timers/domain/timer.ts';
      const [{ timerRepository }, { createTimer, transitionTimer }] =
        await Promise.all([
          import(repositoryModuleUrl),
          import(domainModuleUrl),
        ]);
      const startedAt = Date.now();
      const created = createTimer({
        id: timerId,
        durationMs: duration,
        label: timerLabel,
        createdAt: startedAt,
      });

      if (!created.ok) {
        throw new Error(`Unable to create test timer: ${created.error.code}`);
      }

      const started = transitionTimer(created.value, 'start', startedAt);

      if (!started.ok) {
        throw new Error(`Unable to start test timer: ${started.error.code}`);
      }

      await timerRepository.create(started.value);
    },
    { id, label, durationMs },
  );
}

test('shows a timer completion globally without dismissing a contextual dialog', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__timerAudioPlayCalls = 0;
    HTMLMediaElement.prototype.play = function () {
      window.__timerAudioPlayCalls += 1;
      return Promise.reject(
        new DOMException('Playback blocked for this test.', 'NotAllowedError'),
      );
    };
  });
  await page.clock.install({ time: new Date('2026-10-23T10:00:00.000Z') });
  await page.goto('/clock');
  await seedRunningTimer(page, 'alert-context-timer', 'Tea break', 2_000);
  await page.reload();

  await page.getByRole('link', { name: 'Alarma' }).click();
  await page.getByRole('button', { name: 'Añadir Alarma' }).click();

  const contextualDialog = page.getByRole('dialog', { name: 'Añadir alarma' });
  const draftLabel = contextualDialog.getByRole('textbox', {
    name: 'Etiqueta de la alarma',
  });
  await draftLabel.fill('Draft alarm');

  await page.clock.runFor(2_000);

  const alertDialog = page.getByRole('dialog', {
    name: 'Temporizador finalizado',
  });
  await expect(alertDialog).toBeVisible();
  await expect(alertDialog).toContainText('Tea break');
  await expect.poll(() => page.evaluate(() => window.__timerAudioPlayCalls)).toBe(1);
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await expect(contextualDialog).toBeVisible();
  await expect(draftLabel).toHaveValue('Draft alarm');

  const acceptButton = alertDialog.getByRole('button', { name: 'Aceptar' });
  await expect(acceptButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(alertDialog).not.toBeVisible();
  await expect(contextualDialog).toBeVisible();
  await expect(draftLabel).toHaveValue('Draft alarm');
  await expect(draftLabel).toBeFocused();
});

test('shows one global alert for a timer completed during suspension and uses the fallback label', async ({
  page,
}) => {
  const referenceTime = new Date('2026-10-23T10:00:00.000Z');

  await page.clock.install({ time: referenceTime });
  await page.goto('/clock');
  await seedRunningTimer(page, 'recovered-alert-timer', '   ', 1_000);
  await page.clock.runFor(2_000);
  await page.reload();

  const alertDialog = page.getByRole('dialog', {
    name: 'Temporizador finalizado',
  });
  await expect(alertDialog).toBeVisible();
  await expect(alertDialog).toContainText('Temporizador');
  await expect(
    alertDialog.getByRole('button', { name: 'Aceptar' }),
  ).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(1);

  await page.keyboard.press('Space');
  await expect(alertDialog).not.toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('dialog', { name: 'Temporizador finalizado' }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'Temporizador' }).click();
  await expect(
    page.getByRole('article', { name: 'Temporizador, Finalizado' }),
  ).toBeVisible();
});

test('keeps the global alert available when notifications are denied and Escape accepts it', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__timerAudioPlayCalls = 0;
    window.__timerAudioPauseCalls = 0;
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

    HTMLMediaElement.prototype.play = function () {
      window.__timerAudioPlayCalls += 1;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      window.__timerAudioPauseCalls += 1;
    };
  });
  await page.clock.install({ time: new Date('2026-10-23T10:00:00.000Z') });
  await page.goto('/clock');
  await seedRunningTimer(page, 'denied-notification-timer', 'Focus timer', 1_000);
  await page.reload();
  await page.clock.runFor(1_000);

  const alertDialog = page.getByRole('dialog', {
    name: 'Temporizador finalizado',
  });
  await expect(alertDialog).toBeVisible();
  await expect(alertDialog).toContainText('Focus timer');
  await expect(
    page.evaluate(() => Notification.permission),
  ).resolves.toBe('denied');
  const acceptButton = alertDialog.getByRole('button', { name: 'Aceptar' });
  await expect(acceptButton).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => window.__timerAudioPlayCalls))
    .toBe(1);
  await expect(
    page.evaluate(() => window.__notificationPermissionRequestCount),
  ).resolves.toBe(0);
  await expect(
    page.evaluate(() => window.__notificationConstructorCount),
  ).resolves.toBe(0);

  await page.keyboard.press('Escape');

  await expect(alertDialog).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => window.__timerAudioPauseCalls))
    .toBeGreaterThan(0);
});
