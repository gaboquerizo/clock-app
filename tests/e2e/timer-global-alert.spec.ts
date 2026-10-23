import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __timerAudioPlayCalls: number;
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
