import { spawn } from "node:child_process";

const commands = [
  spawn(process.execPath, ["--watch", "server/index.js"], { stdio: "inherit" }),
  spawn("npm", ["run", "dev:web"], { stdio: "inherit" }),
];

const stop = () => commands.forEach((child) => child.kill("SIGTERM"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
commands.forEach((child) => child.on("exit", (code) => {
  if (code && code !== 0) process.exitCode = code;
}));
