import express from 'express';

export function createGateway(upstreamUrl: string): express.Express {
  const app = express();
  app.get('/health', (_request, response) => response.json({ status: 'ok', upstreamUrl }));
  return app;
}
