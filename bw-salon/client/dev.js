import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.dirname(clientDirectory);
const serverDirectory = path.join(projectDirectory, "server");
const apiPort = Number(process.env.PORT || 5000);
const vitePort = Number(process.env.VITE_PORT || 5173);
let apiProcess;
let viteProcess;
let shuttingDown = false;

const apiAvailable = () => new Promise(resolve => {
  const socket = net.createConnection({ host: "127.0.0.1", port: apiPort });
  socket.setTimeout(500);
  socket.once("connect", () => {
    socket.destroy();
    resolve(true);
  });
  socket.once("timeout", () => {
    socket.destroy();
    resolve(false);
  });
  socket.once("error", () => resolve(false));
});

const requiredApiRoutesAvailable = async () => {
  try {
    const [galleryResponse, offersResponse, notificationResponse, healthResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${apiPort}/api/gallery`),
      fetch(`http://127.0.0.1:${apiPort}/api/offers/active`),
      fetch(`http://127.0.0.1:${apiPort}/api/notifications/status`),
      fetch(`http://127.0.0.1:${apiPort}/api/health`),
    ]);
    return galleryResponse.status !== 404 &&
      offersResponse.status !== 404 &&
      healthResponse.ok &&
      notificationResponse.ok &&
      (await notificationResponse.json()).acknowledgements === true;
  } catch {
    return false;
  }
};

const stop = code => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (viteProcess && !viteProcess.killed) viteProcess.kill();
  if (apiProcess && !apiProcess.killed) apiProcess.kill();
  process.exitCode = code;
};

const waitForApi = async () => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60000) {
    if (await apiAvailable()) return;
    if (apiProcess?.exitCode !== null && apiProcess?.exitCode !== undefined) {
      throw new Error(`The API exited with code ${apiProcess.exitCode}.`);
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`The API did not become available on port ${apiPort} within 60 seconds.`);
};

process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(143));

try {
  if (!(await apiAvailable())) {
    console.log("Starting salon API...");
    apiProcess = spawn(process.execPath, ["server.js"], {
      cwd: serverDirectory,
      env: process.env,
      stdio: "inherit",
    });
    apiProcess.once("error", error => {
      console.error("Could not start the salon API:", error.message);
      stop(1);
    });
    await waitForApi();
  } else {
    console.log(`Using salon API on port ${apiPort}.`);
    if (!(await requiredApiRoutesAvailable())) {
      throw new Error(
        `The API on port ${apiPort} is missing the latest gallery, offers, notification, or health routes. Stop the old API process and restart the salon app so server/server.js can load the current API routes.`,
      );
    }
  }

  if (shuttingDown) process.exit(0);

  viteProcess = spawn(
    process.execPath,
    [
      path.join(clientDirectory, "node_modules", "vite", "bin", "vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      String(vitePort),
      "--strictPort",
    ],
    { cwd: clientDirectory, env: process.env, stdio: "inherit" },
  );
  viteProcess.once("error", error => {
    console.error("Could not start the Vite development server:", error.message);
    stop(1);
  });
  viteProcess.once("exit", (code, signal) => {
    if (!shuttingDown) stop(code ?? (signal ? 1 : 0));
  });
  apiProcess?.once("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`The salon API stopped${signal ? ` (${signal})` : ` (exit ${code})`}.`);
      stop(code ?? 1);
    }
  });
} catch (error) {
  console.error(error.message);
  stop(1);
}
