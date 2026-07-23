import { randomUUID } from "crypto";
import type { BrowserProfile } from "@prisma/client";

import { env } from "../config/env";
import {
  closeLaunchedBrowser,
  launchProfileBrowser,
  type LaunchedBrowser,
} from "./browserLaunch";

const MAX_PREVIEW_SESSIONS = 5;
const PREVIEW_TTL_MS = 30 * 60 * 1000;

export type ProfilePreview = {
  id: string;
  profileId: string;
  profileName: string;
  url: string;
  headed: boolean;
  startedAt: Date;
  createdById: string;
};

type PreviewSession = ProfilePreview & {
  launched: LaunchedBrowser;
  timeout: ReturnType<typeof setTimeout>;
};

class ProfilePreviewManager {
  private sessions = new Map<string, PreviewSession>();

  list(createdById?: string): ProfilePreview[] {
    const items = [...this.sessions.values()].map(({ launched: _l, timeout: _t, ...rest }) => rest);
    if (!createdById) return items;
    return items.filter((s) => s.createdById === createdById);
  }

  get(previewId: string): ProfilePreview | null {
    const session = this.sessions.get(previewId);
    if (!session) return null;
    const { launched: _l, timeout: _t, ...rest } = session;
    return rest;
  }

  async open(
    profile: BrowserProfile,
    createdById: string,
    url: string,
  ): Promise<ProfilePreview> {
    if (this.sessions.size >= MAX_PREVIEW_SESSIONS) {
      throw new Error("Too many preview sessions open. Close one first.");
    }

    // Preview always tries headed so admin can click/type like normal Chrome.
    // Falls back to headless only if env forces it off (e.g. VPS without display).
    const launched = await launchProfileBrowser(profile, {
      headless: !env.automation.browserHeaded,
    });
    const previewId = randomUUID();

    try {
      await launched.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      // Bring window to front when headed
      if (!launched.headless) {
        await launched.page.bringToFront().catch(() => undefined);
      }
    } catch (err) {
      await closeLaunchedBrowser(launched);
      throw err;
    }

    const timeout = setTimeout(() => {
      void this.close(previewId);
    }, PREVIEW_TTL_MS);

    const session: PreviewSession = {
      id: previewId,
      profileId: profile.id,
      profileName: profile.name,
      url,
      headed: !launched.headless,
      startedAt: new Date(),
      createdById,
      launched,
      timeout,
    };

    this.sessions.set(previewId, session);

    // If user closes the Chrome window manually, clean up the session
    launched.browser.on("disconnected", () => {
      const current = this.sessions.get(previewId);
      if (!current) return;
      clearTimeout(current.timeout);
      this.sessions.delete(previewId);
    });

    return {
      id: session.id,
      profileId: session.profileId,
      profileName: session.profileName,
      url: session.url,
      headed: session.headed,
      startedAt: session.startedAt,
      createdById: session.createdById,
    };
  }

  async close(previewId: string): Promise<boolean> {
    const session = this.sessions.get(previewId);
    if (!session) return false;

    clearTimeout(session.timeout);
    this.sessions.delete(previewId);
    await closeLaunchedBrowser(session.launched);
    return true;
  }

  async closeAll(): Promise<void> {
    const ids = [...this.sessions.keys()];
    await Promise.all(ids.map((id) => this.close(id)));
  }

  async screenshot(previewId: string): Promise<Buffer | null> {
    const session = this.sessions.get(previewId);
    if (!session) return null;
    return session.launched.page.screenshot({ type: "png", fullPage: false });
  }
}

export const profilePreviewManager = new ProfilePreviewManager();
