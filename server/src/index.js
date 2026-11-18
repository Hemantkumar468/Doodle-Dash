import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createRealtimeServer } from './app.js';

let resources;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal}: shutting down`);
  resources?.manager.clear();
  await new Promise((resolve) => resources?.io.close(() => resolve()) || resolve());
  await new Promise((resolve) => {
    if (!resources?.httpServer.listening) return resolve();
    resources.httpServer.close(() => resolve());
  });
  await disconnectDatabase();
}

async function main() {
  await connectDatabase();
  resources = createRealtimeServer();
  resources.httpServer.once('error', async (error) => {
    if (error.code === 'EADDRINUSE') console.error(`Port ${env.PORT} is already in use. Stop the other process or change PORT.`);
    else console.error(`Server error: ${error.message}`);
    await shutdown('SERVER_ERROR');
    process.exit(1);
  });
  resources.httpServer.listen(env.PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${env.PORT}`);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    try { await shutdown(signal); process.exit(0); }
    catch (error) { console.error(`Shutdown failed: ${error.message}`); process.exit(1); }
  });
}

main().catch(async (error) => {
  console.error(`Startup failed: ${error.message}`);
  await shutdown('STARTUP_FAILURE');
  process.exitCode = 1;
});

export { shutdown };
