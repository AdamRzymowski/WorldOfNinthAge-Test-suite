import type { JSHandle, Locator, Page } from "@playwright/test";
import { test, expect } from "../support/test";

// Dragging images onto a picker (js/drop.js): the banner's and an event's
// logo, and the gallery. The images are drawn in the page, so they're real
// PNGs the pickers can read.

async function images(page: Page, count = 1): Promise<JSHandle<DataTransfer>> {
  return page.evaluateHandle(async (count) => {
    const transfer = new DataTransfer();
    for (let i = 0; i < count; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 40;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = ["#8b1a10", "#c8973e", "#2f7d32"][i % 3];
      ctx.fillRect(0, 0, 40, 40);
      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
      transfer.items.add(new File([blob], `image-${i + 1}.png`, { type: "image/png" }));
    }
    return transfer;
  }, count);
}

async function drop(zone: Locator, dataTransfer: JSHandle<DataTransfer>) {
  await zone.dispatchEvent("dragenter", { dataTransfer });
  await zone.dispatchEvent("dragover", { dataTransfer });
  await expect(zone).toHaveClass(/dragging/); // outlined while over it
  await zone.dispatchEvent("drop", { dataTransfer });
  await expect(zone).not.toHaveClass(/dragging/);
}

test.describe("Drag and drop images", () => {
  test("an image dropped on the banner's logo row becomes its logo", async ({ page, world, country, joinForm }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await country.addButton.click();
    await country.clickStreetMap();
    const zone = page.locator("#join-logo-field");
    await expect(zone).toContainText("You can also drag an image here.");
    await drop(zone, await images(page));
    await expect(page.locator("#join-logo-preview")).toHaveClass(/has-image/);
    await expect(page.locator("#join-logo-preview-image")).toHaveCount(1);
  });

  test("an image dropped on an event's logo row becomes its logo", async ({ page, world, country, eventForm }) => {
    await world.goto("Poland");
    await country.addEventButton.click();
    const zone = page.locator("#event-logo-field");
    await drop(zone, await images(page));
    await expect(page.locator("#event-logo-preview")).toHaveClass(/has-image/);
  });

  test("images dropped on the gallery's row are picked, up to three", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await page.locator("#community-card-add-images").click();
    const zone = page.locator("#gallery-images-field");
    await expect(zone).toContainText("You can also drag them here.");
    await drop(zone, await images(page, 2));
    await expect(page.locator('#gallery-previews > [id^="gallery-preview-"]')).toHaveCount(2);
    await drop(zone, await images(page, 4));
    await expect(page.locator("#gallery-error")).toHaveText("Please pick at most 3 images at a time.");
  });

  test("a file dropped elsewhere in an open form is ignored, not opened by the browser", async ({ page, world, country, joinForm }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await country.addButton.click();
    await country.clickStreetMap();
    const transfer = await images(page);
    const prevented = await page.locator("#join-title").evaluate((el, dataTransfer) => {
      const event = new DragEvent("drop", { dataTransfer, bubbles: true, cancelable: true });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    }, transfer);
    expect(prevented).toBe(true);
    await expect(joinForm.dialog).toBeVisible();
  });
});
