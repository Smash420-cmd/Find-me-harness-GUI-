/**
 * ClaudeCLIProvider — shells out to the `claude -p` CLI so the harness can
 * use the user's authenticated claude.ai account with no separate API key.
 * stdout = model text only; warnings / connectors notices go to stderr (ignored).
 */
import { spawn } from "node:child_process";
import type { ILLMProvider } from "../index.js";

export class ClaudeCLIProvider implements ILLMProvider {
  readonly name = "claude-cli";

  async complete(prompt: string, opts?: { promptHash?: string; system?: string }): Promise<string> {
    const fullPrompt = opts?.system ? `${opts.system}\n\n${prompt}` : prompt;

    return new Promise((resolve, reject) => {
      // shell:true resolves claude.cmd on Windows without needing the full path.
      const proc = spawn("claude", ["-p", "--output-format", "text"], {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      let out = "";
      let err = "";
      proc.stdout.on("data", (d: Buffer) => (out += d.toString()));
      proc.stderr.on("data", (d: Buffer) => (err += d.toString()));

      proc.on("close", (code) => {
        if (code !== 0) reject(new Error(`claude CLI exited ${code}: ${err.trim()}`));
        else resolve(out.trim());
      });

      proc.on("error", (e) => reject(new Error(`claude CLI not found: ${e.message}`)));
      proc.stdin.write(fullPrompt);
      proc.stdin.end();
    });
  }
}
