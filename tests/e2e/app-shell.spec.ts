import { expect, test } from '@playwright/test';

test('keeps the sidebar fixed while the main region scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/clock');

  const sidebarRegion = page.getByRole('complementary');
  const sidebar = sidebarRegion.locator('.app-sidebar');
  const main = page.getByRole('main');

  const desktopLayout = await sidebar.evaluate((element) => {
    const styles = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();

    return {
      backgroundColor: styles.backgroundColor,
      borderRadius: styles.borderRadius,
      height: bounds.height,
      fontSize: Number.parseFloat(styles.fontSize),
      position: styles.position,
      left: bounds.left,
      top: bounds.top,
      viewportHeight: window.innerHeight,
    };
  });

  expect(desktopLayout.position).toBe('fixed');
  expect(desktopLayout.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(desktopLayout.borderRadius).not.toBe('0px');
  expect(
    Math.abs(
      desktopLayout.height -
        (desktopLayout.viewportHeight - 2 * desktopLayout.fontSize),
    ),
  ).toBeLessThan(1);

  await main.evaluate((element) => {
    const overflowContent = document.createElement('div');
    overflowContent.setAttribute('aria-hidden', 'true');
    overflowContent.style.height = '200vh';
    element.append(overflowContent);
    element.scrollTop = 120;
  });

  const desktopScroll = await main.evaluate((element) => ({
    mainTop: element.scrollTop,
    pageTop: window.scrollY,
  }));
  expect(desktopScroll.mainTop).toBeGreaterThan(0);
  expect(desktopScroll.pageTop).toBe(0);

  await page.setViewportSize({ width: 640, height: 800 });
  const compactSidebar = await sidebar.boundingBox();
  expect(compactSidebar?.x).toBe(desktopLayout.left);
  expect(compactSidebar?.width).toBeLessThan(300);
  await expect
    .poll(() => main.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
});
