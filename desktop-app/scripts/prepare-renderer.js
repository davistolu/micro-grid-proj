const fs = require('fs');
const path = require('path');

const rootOutDir = path.resolve(__dirname, '..', '..', 'out');
const targetRendererDir = path.resolve(__dirname, '..', 'renderer');

console.log('[prepare-renderer] Checking static web build at:', rootOutDir);

if (!fs.existsSync(rootOutDir) || !fs.existsSync(path.join(rootOutDir, 'index.html'))) {
  console.error('[prepare-renderer] Error: Next.js static export not found at:', rootOutDir);
  console.error('[prepare-renderer] Please run "pnpm run build" in the root directory first.');
  process.exit(1);
}

try {
  // Ensure target directory exists and is clean
  if (fs.existsSync(targetRendererDir)) {
    fs.rmSync(targetRendererDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetRendererDir, { recursive: true });

  // Copy all files from root out/ to desktop-app/renderer/
  fs.cpSync(rootOutDir, targetRendererDir, { recursive: true });

  console.log('[prepare-renderer] Successfully synchronized static build to:', targetRendererDir);

  const files = fs.readdirSync(targetRendererDir);
  console.log(`[prepare-renderer] Staged ${files.length} root items including index.html, docs.html, and _next/`);
} catch (err) {
  console.error('[prepare-renderer] Failed to stage renderer files:', err);
  process.exit(1);
}
