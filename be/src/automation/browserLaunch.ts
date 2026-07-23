import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import { env } from "../config/env";
import type { SessionProfile } from "./runner";

export type LaunchedBrowser = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  headless: boolean;
};

export async function launchProfileBrowser(
  profile: SessionProfile,
  options?: { headless?: boolean },
): Promise<LaunchedBrowser> {
  const headless = options?.headless ?? !env.automation.browserHeaded;

  const browser = await chromium.launch({
    headless,
    // Headed preview: real window you can operate like Chrome
    args: headless
      ? ["--no-sandbox", "--disable-setuid-sandbox"]
      : [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--start-maximized",
          "--disable-blink-features=AutomationControlled",
        ],
  });

  const contextOptions: Parameters<typeof browser.newContext>[0] = {};
  if (profile.userAgent) contextOptions.userAgent = profile.userAgent;
  // In headed mode, skip fixed viewport so the window can be resized like normal Chrome
  if (headless && profile.viewportWidth && profile.viewportHeight) {
    contextOptions.viewport = {
      width: profile.viewportWidth,
      height: profile.viewportHeight,
    };
  } else if (!headless) {
    contextOptions.viewport = null;
  } else if (profile.viewportWidth && profile.viewportHeight) {
    contextOptions.viewport = {
      width: profile.viewportWidth,
      height: profile.viewportHeight,
    };
  }
  if (profile.proxyUrl) {
    contextOptions.proxy = { server: profile.proxyUrl };
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  return { browser, context, page, headless };
}

export async function closeLaunchedBrowser(launched: LaunchedBrowser): Promise<void> {
  await launched.context.close().catch(() => undefined);
  await launched.browser.close().catch(() => undefined);
}
