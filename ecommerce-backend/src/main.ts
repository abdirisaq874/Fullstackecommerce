import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    // Enable raw body parsing for Stripe webhooks
    rawBody: true,
  });

  // Security — helmet with sensible defaults
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature', 'X-Request-Id'],
  });

  // Global prefix
  app.setGlobalPrefix(process.env.API_PREFIX || 'api/v1');

  // Versioning
  app.enableVersioning({ type: VersioningType.URI });

  // Global pipes, filters, interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // Swagger API docs (only in non-production)
  // NOTE (F9): The OpenAPI JSON document is exposed at /docs-json (via
  // `jsonDocumentUrl`) alongside the Swagger UI at /docs. This is consumed by
  // the seller-portal-v2 `openapi-typescript` codegen pipeline. We deliberately
  // keep BOTH the UI and the JSON endpoint inside the non-production guard:
  // codegen is expected to run against a developer or staging environment
  // (NODE_ENV !== 'production'), never against a hardened prod deploy. This
  // avoids leaking the full API surface from production hosts.
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('E-Commerce API')
      .setDescription('Full-Stack E-Commerce Backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication & Authorization')
      .addTag('users', 'User Profile & Addresses')
      .addTag('products', 'Product Catalog')
      .addTag('categories', 'Product Categories')
      .addTag('inventory', 'Inventory Management')
      .addTag('cart', 'Shopping Cart')
      .addTag('orders', 'Order Management')
      .addTag('payments', 'Payment Processing')
      .addTag('notifications', 'User Notifications')
      .addTag('admin', 'Admin Dashboard')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
    });
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Server running on http://localhost:${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger docs at http://localhost:${port}/docs`);
    logger.log(`OpenAPI JSON at http://localhost:${port}/docs-json`);
  }
}

bootstrap();
