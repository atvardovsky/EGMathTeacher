import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import configuration from '../config/app.configuration';
import aiConfiguration from '../config/ai.configuration';
import webrtcConfiguration from '../config/webrtc.configuration';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AiModelModule } from '../ai-model/ai-model.module';
import { OpenAiClientModule } from '../openai/openai-client.module';
import { KnowledgeModule } from './knowledge.module';
import { KnowledgePackService } from './knowledge-pack.service';

interface CliOptions {
  path?: string;
  importDb: boolean;
  syncRag: boolean;
  dryRun: boolean;
  force: boolean;
  help: boolean;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
  if (options.help || !options.path) {
    printUsage();
    process.exit(options.path ? 0 : 1);
  }

  const app = await NestFactory.createApplicationContext(KnowledgePackCliModule, {
    logger: ['error', 'warn', 'log'],
  });
  const service = app.get(KnowledgePackService);
  const resolved = service.resolvePackRoot(options.path);

  try {
    const summary = await service.syncKnowledgePack({
      rootPath: resolved.rootPath,
      importDb: options.importDb,
      syncRag: options.syncRag,
      dryRun: options.dryRun,
      force: options.force,
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
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.importDb && !options.syncRag) {
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

Options:
  --pack <zip>    Extract and process a knowledge-pack zip.
  --root <dir>    Process an already extracted knowledge-pack directory.
  --import-db     Import structured JSON/JSONL files into SQLite.
  --sync-rag      Upload/sync selected Markdown files to the active OpenAI vector store.
  --dry-run       Plan RAG sync without OpenAI upload/attach/delete calls.
  --force         Re-import structured files even when their content hash is unchanged.
`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
