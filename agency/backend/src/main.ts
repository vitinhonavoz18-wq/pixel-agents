import { loadConfig } from './config.js';
import { buildServer, VERSION } from './server.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const server = await buildServer({ config, logger: true });
  if (!config.adminToken && server.tokens.count() === 0) {
    // First boot without AGENCY_ADMIN_TOKEN: mint one and print it ONCE.
    const { token } = server.tokens.create({
      name: 'primeiro-admin',
      scopes: ['admin', 'app'],
      projects: '*',
    });
    console.log(
      '\n[PIXEL AGENCY] Token de administrador gerado (guarde-o, não será mostrado novamente):',
    );
    console.log(`  ${token}\n`);
  }
  await server.app.listen({ host: config.host, port: config.port });
  console.log(
    `[PIXEL AGENCY] backend v${VERSION} em http://${config.host}:${config.port} (dados: ${config.dataDir})`,
  );
  const stop = async () => {
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error('[PIXEL AGENCY] falha ao iniciar:', err);
  process.exit(1);
});
