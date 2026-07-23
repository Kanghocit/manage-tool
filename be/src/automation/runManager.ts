import type { AutomationSessionStatus, AutomationRunStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { stepsSchema, type ToolNode } from "./steps";
import { executeSession, type SessionProfile } from "./runner";

const MAX_CONCURRENT_SESSIONS = 5;

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await tasks[current]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

type ActiveRun = {
  cancelled: boolean;
};

class RunManager {
  private activeRuns = new Map<string, ActiveRun>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await prisma.automationRun.updateMany({
      where: { status: { in: ["pending", "running"] } },
      data: {
        status: "failed",
        finishedAt: new Date(),
      },
    });

    await prisma.automationRunSession.updateMany({
      where: { status: { in: ["pending", "running"] } },
      data: {
        status: "failed",
        finishedAt: new Date(),
        error: "Server restarted while run was in progress",
      },
    });
  }

  isRunActive(runId: string): boolean {
    return this.activeRuns.has(runId);
  }

  cancel(runId: string): boolean {
    const active = this.activeRuns.get(runId);
    if (!active) return false;
    active.cancelled = true;
    return true;
  }

  async enqueueRun(runId: string): Promise<void> {
    if (this.activeRuns.has(runId)) return;

    const run = await prisma.automationRun.findUnique({
      where: { id: runId },
      include: {
        tool: true,
        sessions: {
          include: { profile: true },
        },
      },
    });

    if (!run || run.sessions.length === 0) {
      throw new Error("Run not found or has no sessions");
    }

    const parsedSteps = stepsSchema.safeParse(run.tool.steps);
    if (!parsedSteps.success) {
      await this.finalizeRun(runId, "failed");
      throw new Error("Invalid tool steps");
    }

    this.activeRuns.set(runId, { cancelled: false });

    await prisma.automationRun.update({
      where: { id: runId },
      data: {
        status: "running",
        startedAt: new Date(),
      },
    });

    void this.executeRun(runId, parsedSteps.data, run.loopCount, run.sessions).catch(
      (err) => {
        console.error("[automation] run failed", runId, err);
      },
    );
  }

  private async executeRun(
    runId: string,
    steps: ToolNode[],
    loopCount: number,
    sessions: Array<{
      id: string;
      profile: SessionProfile & { id: string; name: string };
    }>,
  ): Promise<void> {
    const active = this.activeRuns.get(runId);
    if (!active) return;

    const limit = MAX_CONCURRENT_SESSIONS;

    const results = await runWithConcurrency(
      sessions.map((session) => async () => {
          if (active.cancelled) {
            await this.updateSession(session.id, {
              status: "cancelled",
              finishedAt: new Date(),
              error: "Cancelled",
            });
            return "cancelled" as const;
          }

          await this.updateSession(session.id, {
            status: "running",
            startedAt: new Date(),
          });

          const result = await executeSession(
            session.profile,
            steps,
            loopCount,
            {
              onLog: async (line) => {
                const current = await prisma.automationRunSession.findUnique({
                  where: { id: session.id },
                  select: { log: true },
                });
                const prev = current?.log ?? "";
                const next = prev ? `${prev}\n${line}` : line;
                const trimmed =
                  next.length > 500_000 ? next.slice(next.length - 500_000) : next;
                await prisma.automationRunSession.update({
                  where: { id: session.id },
                  data: { log: trimmed },
                });
              },
              onLoopProgress: async (currentLoop) => {
                await prisma.automationRunSession.update({
                  where: { id: session.id },
                  data: { currentLoop },
                });
              },
              isCancelled: () => active.cancelled,
            },
          );

          const sessionStatus: AutomationSessionStatus = active.cancelled
            ? "cancelled"
            : result.error
              ? result.error === "Cancelled"
                ? "cancelled"
                : "failed"
              : "completed";

          await this.updateSession(session.id, {
            status: sessionStatus,
            finishedAt: new Date(),
            error: result.error ?? null,
            log: result.log,
          });

          return sessionStatus;
      }),
      limit,
    );

    this.activeRuns.delete(runId);

    const runStatus: AutomationRunStatus = active.cancelled
      ? "cancelled"
      : results.every((s) => s === "completed")
        ? "completed"
        : results.every((s) => s === "cancelled")
          ? "cancelled"
          : "failed";

    await this.finalizeRun(runId, runStatus);
  }

  private async updateSession(
    sessionId: string,
    data: {
      status?: AutomationSessionStatus;
      currentLoop?: number;
      log?: string;
      error?: string | null;
      startedAt?: Date;
      finishedAt?: Date;
    },
  ): Promise<void> {
    await prisma.automationRunSession.update({
      where: { id: sessionId },
      data,
    });
  }

  private async finalizeRun(runId: string, status: AutomationRunStatus): Promise<void> {
    await prisma.automationRun.update({
      where: { id: runId },
      data: {
        status,
        finishedAt: new Date(),
      },
    });
  }
}

export const runManager = new RunManager();
