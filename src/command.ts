import { execFileSync } from "node:child_process";

export function command(file: string, args: string[], cwd?: string): string {
  return execFileSync(file, args, {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 8 * 1024 * 1024,
  }).trim();
}
