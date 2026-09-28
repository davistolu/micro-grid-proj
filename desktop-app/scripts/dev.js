const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const desktopDir = path.resolve(__dirname, '..');
const targetPort = 3000;
const targetUrl = `http://localhost:${targetPort}`;

function checkServerReady(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url, timeoutMs = 45000) {
  const startTime = Date.now();
  console.log(`[desktop:dev] Waiting for web application at ${url}...`);

  while (Date.now() - startTime < timeoutMs) {
    const isReady = await checkServerReady(url);
    if (isReady) {
      console.log(`[desktop:dev] Web application is ready at ${url}`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function start() {
  let devServerProcess = null;
  const alreadyRunning = await checkServerReady(targetUrl);

  if (alreadyRunning) {
    console.log(`[desktop:dev] Detected running dev server at ${targetUrl}`);
  } else {
    console.log('[desktop:dev] Starting Next.js web application dev server...');
    const isWindows = process.platform === 'win32';
    const npmCmd = isWindows ? 'pnpm.cmd' : 'pnpm';

    devServerProcess = spawn(npmCmd, ['run', 'dev'], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
    });

    devServerProcess.on('error', (err) => {
      console.error('[desktop:dev] Failed to start web dev server with pnpm, attempting npm...', err.message);
      devServerProcess = spawn(isWindows ? 'npm.cmd' : 'npm', ['run', 'dev'], {
        cwd: rootDir,
        stdio: 'inherit',
        shell: true,
      });
    });

    const isReady = await waitForServer(targetUrl);
    if (!isReady) {
      console.error('[desktop:dev] Web dev server did not start in time. Launching Electron with local static fallback...');
    }
  }

  console.log('[desktop:dev] Launching Electron...');
  const isWindows = process.platform === 'win32';
  const electronBin = path.join(desktopDir, 'node_modules', '.bin', isWindows ? 'electron.cmd' : 'electron');

  const env = {
    ...process.env,
    NODE_ENV: 'development',
    ELECTRON_FORCE_DEV: '1',
    ELECTRON_DEV_URL: (await checkServerReady(targetUrl)) ? targetUrl : '',
  };

  const electronProcess = spawn(electronBin, ['.'], {
    cwd: desktopDir,
    stdio: 'inherit',
    env,
    shell: true,
  });

  electronProcess.on('close', (code) => {
    console.log(`[desktop:dev] Electron process exited with code ${code}`);
    if (devServerProcess) {
      console.log('[desktop:dev] Stopping background dev server...');
      devServerProcess.kill();
    }
    process.exit(code || 0);
  });
}

start().catch((err) => {
  console.error('[desktop:dev] Unexpected error:', err);
  process.exit(1);
});
