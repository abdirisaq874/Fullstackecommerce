import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkersModule } from './workers/workers.module';

/**
 * Entrypoint for the dedicated workers container: `node dist/src/worker.js`.
 * Headless application context (no HTTP server) that runs BullMQ consumers.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkersModule);
  app.enableShutdownHooks();
  Logger.log('Workers process started (mail consumer)', 'Workers');

  const shutdown = async (signal: string): Promise<void> => {
    Logger.log(`${signal} received — shutting down workers`, 'Workers');
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrap();
