import type { Page } from "playwright";
import type { BrowserProfile } from "@prisma/client";

import { closeLaunchedBrowser, launchProfileBrowser } from "./browserLaunch";

import {
  describeActionStep,
  describeCondition,
  describeNode,
  isActionStep,
  isIfNode,
  type ActionStep,
  type Condition,
  type ToolNode,
} from "./steps";

export type SessionCallbacks = {
  onLog: (line: string) => Promise<void>;
  onLoopProgress: (currentLoop: number) => Promise<void>;
  isCancelled: () => boolean;
};

export type SessionProfile = Pick<
  BrowserProfile,
  "name" | "userAgent" | "proxyUrl" | "viewportWidth" | "viewportHeight"
>;

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_CONDITION_TIMEOUT = 3_000;

async function evaluateCondition(
  page: Page,
  condition: Condition,
): Promise<boolean> {
  const timeout = condition.timeoutMs ?? DEFAULT_CONDITION_TIMEOUT;
  const mode = condition.mode ?? "visible";
  const locator = page.locator(`xpath=${condition.xpath}`);

  let matched = false;
  try {
    if (mode === "visible") {
      await locator.first().waitFor({ state: "visible", timeout });
      matched = true;
    } else {
      await locator.first().waitFor({ state: "attached", timeout });
      matched = (await locator.count()) > 0;
    }
  } catch {
    matched = false;
  }

  if (condition.kind === "notHasElement") {
    return !matched;
  }
  return matched;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function appendLogLine(existing: string, line: string): string {
  const next = existing ? `${existing}\n${line}` : line;
  if (next.length <= 500_000) return next;
  return next.slice(next.length - 500_000);
}

function formatPath(path: number[]): string {
  return path.join(".");
}

async function executeActionStep(page: Page, step: ActionStep): Promise<void> {
  const timeout = "timeoutMs" in step && step.timeoutMs ? step.timeoutMs : DEFAULT_TIMEOUT;

  switch (step.type) {
    case "goto":
      await page.goto(step.url, { waitUntil: "domcontentloaded", timeout });
      return;
    case "click": {
      const locator = page.locator(`xpath=${step.xpath}`);
      await locator.waitFor({ state: "visible", timeout });
      await locator.click({ timeout });
      return;
    }
    case "input": {
      const locator = page.locator(`xpath=${step.xpath}`);
      await locator.waitFor({ state: "visible", timeout });
      if (step.clearFirst) {
        await locator.fill("", { timeout });
      }
      await locator.fill(step.text, { timeout });
      return;
    }
    case "wait":
      await page.waitForTimeout(step.ms);
      return;
    case "waitFor": {
      const locator = page.locator(`xpath=${step.xpath}`);
      await locator.waitFor({ state: "visible", timeout });
      return;
    }
    case "scroll":
      if (step.xpath) {
        const locator = page.locator(`xpath=${step.xpath}`);
        await locator.scrollIntoViewIfNeeded({ timeout });
      } else {
        await page.evaluate((deltaY) => {
          window.scrollBy(0, deltaY);
        }, step.deltaY ?? 300);
      }
      return;
    case "press":
      await page.keyboard.press(step.key);
      return;
    default:
      throw new Error("Unsupported step type");
  }
}

async function executeNodes(
  page: Page,
  nodes: ToolNode[],
  pathPrefix: number[],
  writeLog: (message: string) => Promise<void>,
  isCancelled: () => boolean,
): Promise<void> {
  for (let i = 0; i < nodes.length; i += 1) {
    if (isCancelled()) {
      await writeLog("Session cancelled by user");
      throw new Error("CANCELLED");
    }

    const node = nodes[i];
    const path = [...pathPrefix, i + 1];

    if (isActionStep(node)) {
      const label = describeActionStep(node);
      await writeLog(`Step ${formatPath(path)}: ${label}`);
      await executeActionStep(page, node);
      continue;
    }

    if (node.type === "block") {
      const blockLabel = node.name ? `"${node.name}"` : `#${formatPath(path)}`;
      await writeLog(`>> Block ${blockLabel}`);
      await executeNodes(page, node.children, path, writeLog, isCancelled);
      continue;
    }

    if (isIfNode(node)) {
      const ifLabel = node.name ? `"${node.name}"` : `#${formatPath(path)}`;
      const result = await evaluateCondition(page, node.condition);
      const branchLabel = result ? "Then" : "Else";
      await writeLog(
        `>> If ${ifLabel}: ${describeCondition(node.condition)} = ${result} -> ${branchLabel}`,
      );
      const branchNodes = result ? node.then : node.else;
      await executeNodes(page, branchNodes, path, writeLog, isCancelled);
      continue;
    }

    const loopLabel = node.name ? `"${node.name}"` : `#${formatPath(path)}`;
    for (let loop = 1; loop <= node.loopCount; loop += 1) {
      if (isCancelled()) {
        await writeLog("Session cancelled by user");
        throw new Error("CANCELLED");
      }
      await writeLog(`>> Loop ${loopLabel} ${loop}/${node.loopCount}`);
      await executeNodes(page, node.children, path, writeLog, isCancelled);
    }
  }
}

export async function executeSession(
  profile: SessionProfile,
  steps: ToolNode[],
  loopCount: number,
  callbacks: SessionCallbacks,
): Promise<{ log: string; error?: string }> {
  let log = "";
  let launched: Awaited<ReturnType<typeof launchProfileBrowser>> | null = null;

  const writeLog = async (message: string) => {
    const line = `[${formatTimestamp()}] ${message}`;
    log = appendLogLine(log, line);
    await callbacks.onLog(line);
  };

  try {
    await writeLog(`Starting session with profile "${profile.name}"`);

    launched = await launchProfileBrowser(profile, { headless: true });
    const page = launched.page;

    for (let loop = 1; loop <= loopCount; loop += 1) {
      if (callbacks.isCancelled()) {
        await writeLog("Session cancelled by user");
        throw new Error("CANCELLED");
      }

      await writeLog(`--- Run loop ${loop}/${loopCount} ---`);
      await callbacks.onLoopProgress(loop);
      await executeNodes(page, steps, [], writeLog, callbacks.isCancelled);
      await writeLog(`Run loop ${loop} completed`);
    }

    await writeLog("Session completed successfully");
    return { log };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "CANCELLED") {
      await writeLog("Session stopped");
      return { log, error: "Cancelled" };
    }
    await writeLog(`Error: ${message}`);
    return { log, error: message };
  } finally {
    if (launched) {
      await closeLaunchedBrowser(launched);
    }
  }
}

export { describeNode };
