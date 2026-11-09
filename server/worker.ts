/// <reference types="@cloudflare/workers-types" />
import { httpServerHandler } from 'cloudflare:node';

interface Env {
  HYPERDRIVE: Hyperdrive;
  JWT_SECRET: string;
  CORS_ORIGIN?: string;
}

const serverHandler = httpServerHandler({ port: 8787 });
let initialization: Promise<unknown> | undefined;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    initialization ??= (async () => {
      // Initialize the existing Express API only after Cloudflare bindings are available.
      process.env.CLOUDFLARE_WORKER = 'true';
      process.env.NEON_DATABASE_URL = env.HYPERDRIVE.connectionString;
      process.env.JWT_SECRET = env.JWT_SECRET;
      if (env.CORS_ORIGIN) process.env.CORS_ORIGIN = env.CORS_ORIGIN;
      await import('./index.js');
    })();

    try {
      await initialization;
      return await serverHandler.fetch(request, env, ctx);
    } catch (error) {
      console.error('Cloudflare API initialization failed', error);
      return Response.json({ error: 'API initialization failed' }, { status: 503 });
    }
  },
};
