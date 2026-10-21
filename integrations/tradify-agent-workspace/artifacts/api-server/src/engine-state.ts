import { and, eq, sql } from "drizzle-orm";
import { db, tradifyEngineState } from "@workspace/db";

export type EngineMode = "ACTIVE" | "PAUSED_MANUAL" | "PAUSED_DEGRADED";

export interface EngineState {
  mode: EngineMode;
  reason: string | null;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

class EngineStateStore {
  private state: EngineState = {
    mode: "ACTIVE",
    reason: null,
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
    version: 1,
  };
  private version = 1;
  private readyPromise: Promise<void> | undefined;

  initialize(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        const [stored] = await db
          .select()
          .from(tradifyEngineState)
          .where(eq(tradifyEngineState.key, "default"))
          .limit(1);
        if (stored) {
          this.state = {
            mode: isEngineMode(stored.mode) ? stored.mode : "ACTIVE",
            reason: stored.reason,
            updatedAt: stored.updatedAt,
            updatedBy: stored.updatedBy,
            version: stored.version,
          };
          this.version = stored.version;
        } else {
          await this.persist();
        }
      })();
    }
    return this.readyPromise;
  }

  async ready(): Promise<void> {
    await this.initialize();
  }

  get(): EngineState {
    return { ...this.state };
  }

  getVersion(): number {
    return this.version;
  }

  isActive(): boolean {
    return this.state.mode === "ACTIVE";
  }

  pause(reason: string, updatedBy: string): EngineState {
    this.state = {
      mode: "PAUSED_MANUAL",
      reason: reason.trim() || "Paused by an administrator",
      updatedAt: new Date().toISOString(),
      updatedBy,
      version: this.version,
    };
    return this.get();
  }

  resume(updatedBy: string): EngineState {
    this.state = {
      mode: "ACTIVE",
      reason: null,
      updatedAt: new Date().toISOString(),
      updatedBy,
      version: this.version,
    };
    return this.get();
  }

  async pauseIfVersion(
    reason: string,
    updatedBy: string,
    expectedVersion: number,
  ): Promise<EngineState> {
    return this.updateIfVersion(
      "PAUSED_MANUAL",
      reason.trim() || "Paused by an administrator",
      updatedBy,
      expectedVersion,
    );
  }

  async resumeIfVersion(updatedBy: string, expectedVersion: number): Promise<EngineState> {
    return this.updateIfVersion("ACTIVE", null, updatedBy, expectedVersion);
  }

  private async updateIfVersion(
    mode: EngineMode,
    reason: string | null,
    updatedBy: string,
    expectedVersion: number,
  ): Promise<EngineState> {
    await this.ready();
    const updatedAt = new Date().toISOString();
    const [updated] = await db
      .update(tradifyEngineState)
      .set({
        mode,
        reason,
        updatedAt,
        updatedBy,
        version: sql`${tradifyEngineState.version} + 1`,
      })
      .where(
        and(eq(tradifyEngineState.key, "default"), eq(tradifyEngineState.version, expectedVersion)),
      )
      .returning({ version: tradifyEngineState.version });
    if (!updated) {
      throw new ConcurrentUpdateError("engine state");
    }
    this.state = { mode, reason, updatedAt, updatedBy, version: updated.version };
    this.version = updated.version;
    return this.get();
  }

  async persist(): Promise<void> {
    const state = this.state;
    const [updated] = await db
      .update(tradifyEngineState)
      .set({
        mode: state.mode,
        reason: state.reason,
        updatedAt: state.updatedAt,
        updatedBy: state.updatedBy,
        version: sql`${tradifyEngineState.version} + 1`,
      })
      .where(
        and(eq(tradifyEngineState.key, "default"), eq(tradifyEngineState.version, this.version)),
      )
      .returning({ version: tradifyEngineState.version });
    if (updated) {
      this.version = updated.version;
      this.state.version = updated.version;
      return;
    }
    const [existing] = await db
      .select({ version: tradifyEngineState.version })
      .from(tradifyEngineState)
      .where(eq(tradifyEngineState.key, "default"))
      .limit(1);
    if (existing) {
      throw new ConcurrentUpdateError("engine state");
    }
    await db.insert(tradifyEngineState).values({
      key: "default",
      mode: state.mode,
      reason: state.reason,
      updatedAt: state.updatedAt,
      updatedBy: state.updatedBy,
      version: this.version,
    });
  }
}

export class ConcurrentUpdateError extends Error {
  readonly code = "CONCURRENT_UPDATE";

  constructor(resource: string) {
    super(`The ${resource} changed before this update was saved.`);
    this.name = "ConcurrentUpdateError";
  }
}

function isEngineMode(value: string): value is EngineMode {
  return value === "ACTIVE" || value === "PAUSED_MANUAL" || value === "PAUSED_DEGRADED";
}

export const engineState = new EngineStateStore();
export const engineStateReady = engineState.initialize();
