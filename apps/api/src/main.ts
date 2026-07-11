import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';

async function bootstrap() {
  const httpsKeyPath = process.env.HTTPS_KEY_PATH;
  const httpsCertPath = process.env.HTTPS_CERT_PATH;
  const httpsOptions =
    httpsKeyPath && httpsCertPath && existsSync(httpsKeyPath) && existsSync(httpsCertPath)
      ? {
          key: readFileSync(httpsKeyPath),
          cert: readFileSync(httpsCertPath),
        }
      : undefined;

  const app = await NestFactory.create(AppModule, httpsOptions ? { httpsOptions } : undefined);
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3000;

  const corsOriginsRaw = config.get<string>('CORS_ORIGINS') ?? '';
  const corsOrigins = corsOriginsRaw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const corsCredentialsRaw = config.get<string>('CORS_CREDENTIALS') ?? 'true';
  const corsCredentials = ['true', '1', 'yes', 'y', 'on'].includes(
    corsCredentialsRaw.toLowerCase(),
  );
  const allowAnyOrigin =
    corsOrigins.length === 0 || corsOrigins.includes('*') || corsOriginsRaw === '*';
  const originOption = allowAnyOrigin && !corsCredentials ? '*' : allowAnyOrigin ? true : corsOrigins;

  app.use((_: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.enableCors({
    origin: originOption,
    credentials: corsCredentials,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  await app.listen(port);
  Logger.log(`Voice assistant service listening on port ${port}`, 'Bootstrap');
}

bootstrap().catch((error) => {
  Logger.error('Failed to bootstrap application', error);
  process.exitCode = 1;
});
