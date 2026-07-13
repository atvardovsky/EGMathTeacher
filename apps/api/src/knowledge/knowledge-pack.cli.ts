import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { existsSync } from 'fs';
import { resolve } from 'path';
import configuration from '../config/app.configuration';
import aiConfiguration from '../config/ai.configuration';
import webrtcConfiguration from '../config/webrtc.configuration';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AiModelModule } from '../ai-model/ai-model.module';
import { OpenAiClientModule } from '../openai/openai-client.module';
import { KnowledgeModule } from './knowledge.module';
import { KnowledgePackService } from './knowledge-pack.service';
import { KnowledgeService } from './knowledge.service';

interface CliOptions {
  path?: string;
  importDb: boolean;
  syncRag: boolean;
  dryRun: boolean;
  force: boolean;
  importMode: 'strict' | 'partial';
  waitUntilIndexed?: boolean;
  reconcileRag?: boolean;
  recoverRag: boolean;
  help: boolean;
}

if (!process.env.SQLITE_PATH && existsSync(resolve(process.cwd(), 'apps/api'))) {
  process.env.SQLITE_PATH = 'apps/api/data/app.sqlite';
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), 'apps/api/.env'),
        resolve(process.cwd(), '.env'),
      ],
      load: [configuration, webrtcConfiguration, aiConfiguration],
    }),
    DatabaseModule,
    AuthModule,
    OpenAiClientModule,
    AiModelModule,
    KnowledgeModule,
  ],
})
class KnowledgePackCliModule {}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || (!options.path && !options.recoverRag)) {
    printUsage();
    process.exit(options.path || options.recoverRag ? 0 : 1);
  }

  const app = await NestFactory.createApplicationContext(KnowledgePackCliModule, {
    logger: ['error', 'warn', 'log'],
  });
  if (options.recoverRag) {
    try {
      const knowledgeService = app.get(KnowledgeService);
      const summary = await knowledgeService.recoverFailedRagSyncJobs(
        options.waitUntilIndexed ?? true,
      );
      console.log(JSON.stringify(summary, null, 2));
    } finally {
      await app.close();
    }
    return;
  }

  const service = app.get(KnowledgePackService);
  const resolved = service.resolvePackRoot(options.path as string);

  try {
    const summary = await service.syncKnowledgePack({
      rootPath: resolved.rootPath,
      importDb: options.importDb,
      syncRag: options.syncRag,
      dryRun: options.dryRun,
      force: options.force,
      importMode: options.importMode,
      waitUntilIndexed: options.waitUntilIndexed ?? (options.syncRag && !options.dryRun),
      reconcileRag: options.reconcileRag,
    });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    resolved.cleanup?.();
    await app.close();
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    importDb: false,
    syncRag: false,
    dryRun: false,
    force: false,
    importMode: 'strict',
    waitUntilIndexed: undefined,
    reconcileRag: undefined,
    recoverRag: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--pack':
      case '--root':
        options.path = args[index + 1];
        index += 1;
        break;
      case '--import-db':
        options.importDb = true;
        break;
      case '--sync-rag':
        options.syncRag = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--partial':
        options.importMode = 'partial';
        break;
      case '--strict':
        options.importMode = 'strict';
        break;
      case '--wait-ready':
        options.waitUntilIndexed = true;
        break;
      case '--no-wait-ready':
        options.waitUntilIndexed = false;
        break;
      case '--reconcile-rag':
        options.reconcileRag = true;
        break;
      case '--no-reconcile-rag':
        options.reconcileRag = false;
        break;
      case '--recover-rag':
        options.recoverRag = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.recoverRag && !options.importDb && !options.syncRag) {
    options.importDb = true;
  }
  return options;
}

function printUsage(): void {
  console.log(`
Usage:
  npm run knowledge:sync -- --pack ./EGMathTeacher-knowledge-pack-v1.0.zip --import-db
  npm run knowledge:sync -- --pack ./EGMathTeacher-knowledge-pack-v1.0.zip --import-db --sync-rag
  npm run knowledge:sync -- --root ./EGMathTeacher-knowledge-pack-v1.0 --sync-rag --dry-run
  npm run knowledge:sync -- --recover-rag --wait-ready

Options:
  --pack <zip>    Extract and process a knowledge-pack zip.
  --root <dir>    Process an already extracted knowledge-pack directory.
  --import-db     Import structured JSON/JSONL files into SQLite.
  --sync-rag      Upload/sync selected Markdown files to the active OpenAI vector store.
  --dry-run       Plan RAG sync without OpenAI upload/attach/delete calls.
  --force         Re-import structured files even when their content hash is unchanged.
  --strict        Require all canonical structured files. Default.
  --partial       Allow missing structured files and report warnings.
  --wait-ready    Poll attached vector-store files and mark indexed only after completed.
  --no-wait-ready Do not wait for vector-store indexing.
  --reconcile-rag Detach active RAG source paths missing from this strict authoritative pack.
  --no-reconcile-rag
                  Keep existing RAG source paths even if absent from this pack.
  --recover-rag   Retry failed or attached-timeout RAG sync jobs. Waits for completed indexing by default.
`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
