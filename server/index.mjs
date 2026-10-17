import { createGateway, readConfig } from './gateway.mjs';
try {
  const config = readConfig();
  const server = createGateway(config);
  // Intentionally loopback-only. Public deployment requires real server-side identity and durable quotas.
  server.listen(config.port, '127.0.0.1', () => console.log(`MotiBuddy private AI gateway: http://127.0.0.1:${config.port}`));
  server.on('error', () => { console.error('Cannot start gateway. Check the configured port.'); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); server.closeAllConnections(); });
} catch (error) { console.error(error.message); process.exitCode = 1; }
