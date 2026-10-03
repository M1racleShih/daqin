import { mkdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { Input } from "./input.ts";
import type { Identity } from "./process.ts";
import type { PullRequest } from "./github.ts";
import type { readFeedback } from "./github.ts";

export type Task = {
  id: string; input: Input; status: string; lastCommit: string; baseCommit: string;
  snapshots: Record<string, string>; pr?: PullRequest; workspaceDigest?: string; error?: string;
  feedback?: ReturnType<typeof readFeedback>; feedbackKey?: string;
  observedWorkspaceDigest?: string;
};
export type Run = {
  id: string; taskId: string; controller: Identity; process?: Identity; phase: string;
  started: string; ended?: string; error?: string; result?: unknown;
};

export class Store {
  db: DatabaseSync;
  directory: string;
  constructor(directory: string) {
    mkdirSync(resolve(directory), { recursive: true, mode: 0o700 });
    this.directory = realpathSync(directory);
    this.db = new DatabaseSync(join(this.directory, "state.sqlite"));
    this.db.exec("PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;");
    const version = (this.db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
    if (version > 1) throw new Error("Unsupported state schema; use a compatible Daqin version");
    this.db.exec(`CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, task_id TEXT NOT NULL,
        active INTEGER NOT NULL, cancel_requested INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_run ON runs(active) WHERE active=1;
      PRAGMA user_version=1;`);
  }
  close() { this.db.close(); }
  task(id: string): Task | undefined {
    const row = this.db.prepare("SELECT data FROM tasks WHERE id=?").get(id) as { data: string } | undefined;
    return row && JSON.parse(row.data);
  }
  tasks(): Task[] { return (this.db.prepare("SELECT data FROM tasks ORDER BY id").all() as { data: string }[]).map(row => JSON.parse(row.data)); }
  saveTask(task: Task) {
    this.db.prepare("INSERT INTO tasks VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").run(task.id, JSON.stringify(task));
  }
  run(id: string): Run {
    const row = this.db.prepare("SELECT data FROM runs WHERE id=?").get(id) as { data: string };
    return JSON.parse(row.data);
  }
  active(): Run | undefined {
    const row = this.db.prepare("SELECT data FROM runs WHERE active=1").get() as { data: string } | undefined;
    return row && JSON.parse(row.data);
  }
  runs(taskId: string): Run[] {
    return (this.db.prepare("SELECT data FROM runs WHERE task_id=? ORDER BY rowid").all(taskId) as { data: string }[]).map(row => JSON.parse(row.data));
  }
  saveRun(run: Run) { this.db.prepare("UPDATE runs SET data=? WHERE id=?").run(JSON.stringify(run), run.id); }
  cancelled(id: string): boolean {
    return (this.db.prepare("SELECT cancel_requested FROM runs WHERE id=?").get(id) as { cancel_requested: number }).cancel_requested === 1;
  }
  requestStop(id: string) { this.db.prepare("UPDATE runs SET cancel_requested=1 WHERE id=? AND active=1").run(id); }
  claim(task: Task, controller: Identity, isNew: boolean): Run | undefined {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (isNew && this.task(task.id)) { this.db.exec("COMMIT"); return; }
      const active = this.active();
      if (active) throw new Error(`Run ${active.id} owns the controller; stop/reconcile it before starting another`);
      const run: Run = { id: randomUUID(), taskId: task.id, controller, phase: "preparing", started: new Date().toISOString() };
      this.saveTask(task);
      this.db.prepare("INSERT INTO runs(id,task_id,active,data) VALUES (?,?,1,?)").run(run.id, task.id, JSON.stringify(run));
      this.db.exec("COMMIT"); return run;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  finish(task: Task, run: Run) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      run.ended = new Date().toISOString();
      this.saveTask(task); this.saveRun(run);
      this.db.prepare("UPDATE runs SET active=0 WHERE id=?").run(run.id);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
}
