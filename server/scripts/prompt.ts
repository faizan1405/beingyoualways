import { createInterface } from "node:readline";

/** Reads a value without echoing it to the terminal (for passwords). */
export function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let muted = false;
    out._writeToOutput = (s: string) => { if (!muted || s.includes("\n")) out.output.write(muted ? "\n" : s); };
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
    muted = true;
  });
}

export function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
