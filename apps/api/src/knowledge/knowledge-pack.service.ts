import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'fs';
import { tmpdir } from 'os';
import { basename, join, relative, resolve, sep } from 'path';
import { spawnSync } from 'child_process';
import { DatabaseService } from '../database/database.service';
import { KnowledgeService, SyncRagSourceFileResult } from './knowledge.service';

type JsonObject = Record<string, unknown>;

interface PackFile {
  absolutePath: string;
  relativePath: string;
  buffer: Buffer;
  contentHash: string;
  sizeBytes: number;
}

interface SourceFileStateInput {
  sourcePackVersion: string;
  relativePath: string;
  targetKind: 'db_structured' | 'student_rag' | 'metadata';
  contentHash: string;
  sizeBytes: number;
  status: 'pending' | 'imported' | 'synced' | 'skipped' | 'failed';
  metadata: JsonObject;
  knowledgeFileId?: string;
  errorMessage?: string;
}

export interface KnowledgePackImportSummary {
  packVersion: string;
  rootPath: string;
  structuredFiles: number;
  importedRows: number;
  skippedFiles: number;
}

export interface KnowledgePackRagSyncSummary {
  packVersion: string;
  rootPath: string;
  ragFiles: number;
  uploadedFiles: number;
  replacedFiles: number;
  skippedFiles: number;
  dryRun: boolean;
  results: SyncRagSourceFileResult[];
}

export interface KnowledgePackSyncOptions {
  rootPath: string;
  importDb?: boolean;
  syncRag?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

export interface KnowledgePackSyncSummary {
  packVersion: string;
  rootPath: string;
  structured?: KnowledgePackImportSummary;
  rag?: KnowledgePackRagSyncSummary;
}

const STRUCTURED_FILE_PATHS = [
  'rag-corpus/02-curriculum/curriculum-topics.json',
  'rag-corpus/02-curriculum/curriculum-task-types.json',
  'rag-corpus/02-curriculum/curriculum-skills.json',
  'rag-corpus/02-curriculum/curriculum-prerequisites.json',
  'rag-corpus/02-curriculum/curriculum-mastery-criteria.json',
  'rag-corpus/02-curriculum/curriculum-misconceptions.json',
  'rag-corpus/04-task-bank/task-bank-index.json',
  'rag-corpus/04-task-bank/tasks-base.jsonl',
  'rag-corpus/04-task-bank/tasks-diagnostic.jsonl',
  'rag-corpus/04-task-bank/tasks-profile.jsonl',
  'rag-corpus/04-task-bank/tasks-retry.jsonl',
  'rag-corpus/04-task-bank/tasks-review.jsonl',
  'rag-corpus/05-misconceptions/error-classification.json',
  'learning-plans/lesson-type-plan.json',
];

@Injectable()
export class KnowledgePackService {
  constructor(
    private readonly db: DatabaseService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  resolvePackRoot(inputPath: string): { rootPath: string; cleanup?: () => void } {
    const absolute = resolve(inputPath);
    if (!existsSync(absolute)) {
      throw new BadRequestException(`Knowledge pack path does not exist: ${inputPath}`);
    }
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      return { rootPath: this.normalizePackRoot(absolute) };
    }
    if (!absolute.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('Knowledge pack must be an extracted directory or .zip file');
    }

    const target = mkdtempSync(join(tmpdir(), 'egmathteacher-knowledge-pack-'));
    const result = spawnSync('unzip', ['-q', absolute, '-d', target], {
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      rmSync(target, { recursive: true, force: true });
      throw new BadRequestException(
        `Could not extract knowledge pack: ${(result.stderr || result.stdout).trim()}`,
      );
    }

    return {
      rootPath: this.normalizePackRoot(target),
      cleanup: () => rmSync(target, { recursive: true, force: true }),
    };
  }

  async syncKnowledgePack(options: KnowledgePackSyncOptions): Promise<KnowledgePackSyncSummary> {
    const rootPath = this.normalizePackRoot(options.rootPath);
    const packVersion = this.detectPackVersion(rootPath);
    const summary: KnowledgePackSyncSummary = { packVersion, rootPath };

    if (options.importDb) {
      summary.structured = this.importStructured({
        rootPath,
        packVersion,
        force: options.force ?? false,
      });
    }

    if (options.syncRag) {
      summary.rag = await this.syncStudentRag({
        rootPath,
        packVersion,
        dryRun: options.dryRun ?? false,
      });
    }

    this.insertImportLedger({
      packVersion,
      rootPath,
      importKind:
        options.importDb && options.syncRag
          ? 'structured_and_rag'
          : options.syncRag
            ? 'rag'
            : 'structured',
      structuredFileCount: summary.structured?.structuredFiles ?? 0,
      ragFileCount: summary.rag?.ragFiles ?? 0,
      importedRowCount: summary.structured?.importedRows ?? 0,
      uploadedFileCount: summary.rag?.uploadedFiles ?? 0,
      skippedFileCount:
        (summary.structured?.skippedFiles ?? 0) + (summary.rag?.skippedFiles ?? 0),
      status: 'completed',
    });

    return summary;
  }

  importStructured(input: {
    rootPath: string;
    packVersion?: string;
    force?: boolean;
  }): KnowledgePackImportSummary {
    const rootPath = this.normalizePackRoot(input.rootPath);
    const packVersion = input.packVersion ?? this.detectPackVersion(rootPath);
    let structuredFiles = 0;
    let importedRows = 0;
    let skippedFiles = 0;

    this.db.transaction(() => {
      for (const relativePath of STRUCTURED_FILE_PATHS) {
        const file = this.readPackFile(rootPath, relativePath);
        if (!file) {
          continue;
        }

        structuredFiles += 1;
        if (!input.force && this.isAlreadyImported(packVersion, file)) {
          skippedFiles += 1;
          this.upsertSourceFile({
            sourcePackVersion: packVersion,
            relativePath,
            targetKind: 'db_structured',
            contentHash: file.contentHash,
            sizeBytes: file.sizeBytes,
            status: 'skipped',
            metadata: { reason: 'same_content_hash' },
          });
          continue;
        }

        importedRows += this.importStructuredFile(packVersion, file);
        this.upsertSourceFile({
          sourcePackVersion: packVersion,
          relativePath,
          targetKind: 'db_structured',
          contentHash: file.contentHash,
          sizeBytes: file.sizeBytes,
          status: 'imported',
          metadata: { importedAt: new Date().toISOString() },
        });
      }
    });

    return {
      packVersion,
      rootPath,
      structuredFiles,
      importedRows,
      skippedFiles,
    };
  }

  async syncStudentRag(input: {
    rootPath: string;
    packVersion?: string;
    dryRun?: boolean;
  }): Promise<KnowledgePackRagSyncSummary> {
    const rootPath = this.normalizePackRoot(input.rootPath);
    const packVersion = input.packVersion ?? this.detectPackVersion(rootPath);
    const files = this.scanPackFiles(rootPath).filter((file) => this.isStudentRagFile(file));
    const results: SyncRagSourceFileResult[] = [];

    for (const file of files) {
      const result = await this.knowledgeService.syncRagSourceFile({
        relativePath: file.relativePath,
        buffer: file.buffer,
        mimeType: 'text/markdown',
        sourcePackVersion: packVersion,
        contentHash: file.contentHash,
        dryRun: input.dryRun ?? false,
      });
      results.push(result);

      if (!input.dryRun) {
        this.upsertSourceFile({
          sourcePackVersion: packVersion,
          relativePath: file.relativePath,
          targetKind: 'student_rag',
          contentHash: file.contentHash,
          sizeBytes: file.sizeBytes,
          status: result.action === 'skipped' ? 'skipped' : 'synced',
          knowledgeFileId: result.knowledgeFileId,
          metadata: {
            action: result.action,
            vectorStoreId: result.vectorStoreId,
            openAiFileId: result.openAiFileId,
          },
        });
      }
    }

    return {
      packVersion,
      rootPath,
      ragFiles: files.length,
      uploadedFiles: results.filter((result) => result.action === 'uploaded').length,
      replacedFiles: results.filter((result) => result.action === 'replaced').length,
      skippedFiles: results.filter((result) => result.action.startsWith('skipped')).length,
      dryRun: input.dryRun ?? false,
      results,
    };
  }

  private importStructuredFile(packVersion: string, file: PackFile): number {
    switch (file.relativePath) {
      case 'rag-corpus/02-curriculum/curriculum-topics.json':
        return this.importTopics(packVersion, file);
      case 'rag-corpus/02-curriculum/curriculum-task-types.json':
        return this.importTaskTypes(packVersion, file);
      case 'rag-corpus/02-curriculum/curriculum-skills.json':
        return this.importSkills(packVersion, file);
      case 'rag-corpus/02-curriculum/curriculum-prerequisites.json':
        return this.importPrerequisites(packVersion, file);
      case 'rag-corpus/02-curriculum/curriculum-mastery-criteria.json':
        return this.importMasteryCriteria(packVersion, file);
      case 'rag-corpus/02-curriculum/curriculum-misconceptions.json':
        return this.importMisconceptions(packVersion, file);
      case 'rag-corpus/05-misconceptions/error-classification.json':
        return this.importErrorClassification(packVersion, file);
      case 'learning-plans/lesson-type-plan.json':
        return this.importLessonTypePlan(packVersion, file);
      default:
        if (file.relativePath.endsWith('.jsonl')) {
          return this.importTaskBank(packVersion, file);
        }
        if (file.relativePath === 'rag-corpus/04-task-bank/task-bank-index.json') {
          return this.importTaskBankIndex(packVersion, file);
        }
        return 0;
    }
  }

  private importTopics(packVersion: string, file: PackFile): number {
    const items = this.readItems(file);
    const now = new Date().toISOString();
    for (const item of items) {
      this.db.run(
        `INSERT INTO curriculum_topics (
           topic_id, title, exam_track, prerequisite_topic_ids_json, skill_ids_json,
           theory_document_id, status, source_pack_version, source_path,
           content_hash, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(topic_id) DO UPDATE SET
           title = excluded.title,
           exam_track = excluded.exam_track,
           prerequisite_topic_ids_json = excluded.prerequisite_topic_ids_json,
           skill_ids_json = excluded.skill_ids_json,
           theory_document_id = excluded.theory_document_id,
           status = excluded.status,
           source_pack_version = excluded.source_pack_version,
           source_path = excluded.source_path,
           content_hash = excluded.content_hash,
           updated_at = excluded.updated_at`,
        [
          this.stringValue(item.topic_id),
          this.stringValue(item.title),
          this.stringValue(item.exam_track),
          JSON.stringify(this.arrayValue(item.prerequisite_topic_ids)),
          JSON.stringify(this.arrayValue(item.skill_ids)),
          this.optionalString(item.theory_document_id),
          this.stringValue(item.status),
          packVersion,
          file.relativePath,
          file.contentHash,
          now,
          now,
        ],
      );
    }
    return items.length;
  }

  private importTaskTypes(packVersion: string, file: PackFile): number {
    const items = this.readItems(file);
    const now = new Date().toISOString();
    for (const item of items) {
      this.db.run(
        `INSERT INTO curriculum_task_types (
           task_type_id, title, exam_track, response_kind, runtime_verifier_kind,
           planned_verifier_kind, year_binding, source_pack_version, source_path,
           content_hash, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(task_type_id) DO UPDATE SET
           title = excluded.title,
           exam_track = excluded.exam_track,
           response_kind = excluded.response_kind,
           runtime_verifier_kind = excluded.runtime_verifier_kind,
           planned_verifier_kind = excluded.planned_verifier_kind,
           year_binding = excluded.year_binding,
           source_pack_version = excluded.source_pack_version,
           source_path = excluded.source_path,
           content_hash = excluded.content_hash,
           updated_at = excluded.updated_at`,
        [
          this.stringValue(item.task_type_id),
          this.stringValue(item.title),
          this.stringValue(item.exam_track),
          this.stringValue(item.response_kind),
          this.stringValue(item.runtime_verifier_kind),
          this.stringValue(item.planned_verifier_kind),
          this.optionalString(item.year_binding),
          packVersion,
          file.relativePath,
          file.contentHash,
          now,
          now,
        ],
      );
    }
    return items.length;
  }

  private importSkills(packVersion: string, file: PackFile): number {
    const items = this.readItems(file);
    const now = new Date().toISOString();
    for (const item of items) {
      const taskTypeIds = this.arrayValue(item.task_type_ids).map((value) => String(value));
      const primaryTaskTypeId = taskTypeIds[0] ?? 'unsupported';
      const taskType = this.db.get<{
        title: string;
        runtime_verifier_kind: string;
      }>(
        'SELECT title, runtime_verifier_kind FROM curriculum_task_types WHERE task_type_id = ?',
        [primaryTaskTypeId],
      );
      const topic = this.db.get<{ title: string }>(
        'SELECT title FROM curriculum_topics WHERE topic_id = ?',
        [this.stringValue(item.topic_id)],
      );
      this.db.run(
        `INSERT INTO curriculum_skills (
           skill_id, topic_id, topic_title, skill_title, task_type_id,
           task_type_title, verifier_kind, created_at, description,
           prerequisites_json, task_type_ids_json, typical_misconceptions_json,
           explanation_methods_json, minimum_mastery_criterion,
           verification_methods_json, recommended_lesson_type,
           deterministic_verification, difficulty, estimated_learning_minutes,
           source_pack_version, source_path, content_hash, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(skill_id) DO UPDATE SET
           topic_id = excluded.topic_id,
           topic_title = excluded.topic_title,
           skill_title = excluded.skill_title,
           task_type_id = excluded.task_type_id,
           task_type_title = excluded.task_type_title,
           verifier_kind = excluded.verifier_kind,
           description = excluded.description,
           prerequisites_json = excluded.prerequisites_json,
           task_type_ids_json = excluded.task_type_ids_json,
           typical_misconceptions_json = excluded.typical_misconceptions_json,
           explanation_methods_json = excluded.explanation_methods_json,
           minimum_mastery_criterion = excluded.minimum_mastery_criterion,
           verification_methods_json = excluded.verification_methods_json,
           recommended_lesson_type = excluded.recommended_lesson_type,
           deterministic_verification = excluded.deterministic_verification,
           difficulty = excluded.difficulty,
           estimated_learning_minutes = excluded.estimated_learning_minutes,
           source_pack_version = excluded.source_pack_version,
           source_path = excluded.source_path,
           content_hash = excluded.content_hash,
           updated_at = excluded.updated_at`,
        [
          this.stringValue(item.skill_id),
          this.stringValue(item.topic_id),
          topic?.title ?? this.stringValue(item.topic_id),
          this.stringValue(item.title),
          primaryTaskTypeId,
          taskType?.title ?? primaryTaskTypeId,
          taskType?.runtime_verifier_kind === 'linear_equation_numeric'
            ? 'linear_equation_numeric'
            : 'unsupported',
          now,
          this.optionalString(item.description),
          JSON.stringify(this.arrayValue(item.prerequisites)),
          JSON.stringify(taskTypeIds),
          JSON.stringify(this.arrayValue(item.typical_misconceptions)),
          JSON.stringify(this.arrayValue(item.explanation_methods)),
          this.optionalString(item.minimum_mastery_criterion),
          JSON.stringify(this.arrayValue(item.verification_methods)),
          this.optionalString(item.recommended_lesson_type),
          this.optionalString(item.deterministic_verification),
          this.optionalString(item.difficulty),
          this.optionalNumber(item.estimated_learning_minutes),
          packVersion,
          file.relativePath,
          file.contentHash,
          now,
        ],
      );
    }
    return items.length;
  }

  private importPrerequisites(packVersion: string, file: PackFile): number {
    const parsed = this.readJson(file);
    const topicEdges = this.arrayObjects(parsed.topic_edges);
    const skillEdges = this.arrayObjects(parsed.skill_edges);
    const now = new Date().toISOString();
    let count = 0;
    for (const edge of topicEdges) {
      this.upsertPrerequisiteEdge(packVersion, file, now, 'topic', edge);
      count += 1;
    }
    for (const edge of skillEdges) {
      this.upsertPrerequisiteEdge(packVersion, file, now, 'skill', edge);
      count += 1;
    }
    return count;
  }

  private importMasteryCriteria(packVersion: string, file: PackFile): number {
    const items = this.readItems(file);
    const now = new Date().toISOString();
    for (const item of items) {
      this.db.run(
        `INSERT INTO curriculum_mastery_criteria (
           skill_id, minimum_criterion, required_evidence_sequence_json,
           self_report_can_complete, single_success_can_complete,
           recommended_recheck_days_json, regression_trigger,
           source_pack_version, source_path, content_hash, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(skill_id) DO UPDATE SET
           minimum_criterion = excluded.minimum_criterion,
           required_evidence_sequence_json = excluded.required_evidence_sequence_json,
           self_report_can_complete = excluded.self_report_can_complete,
           single_success_can_complete = excluded.single_success_can_complete,
           recommended_recheck_days_json = excluded.recommended_recheck_days_json,
           regression_trigger = excluded.regression_trigger,
           source_pack_version = excluded.source_pack_version,
           source_path = excluded.source_path,
           content_hash = excluded.content_hash,
           updated_at = excluded.updated_at`,
        [
          this.stringValue(item.skill_id),
          this.stringValue(item.minimum_criterion),
          JSON.stringify(this.arrayValue(item.required_evidence_sequence)),
          this.booleanInt(item.self_report_can_complete),
          this.booleanInt(item.single_success_can_complete),
          JSON.stringify(this.arrayValue(item.recommended_recheck_days)),
          this.stringValue(item.regression_trigger),
          packVersion,
          file.relativePath,
          file.contentHash,
          now,
          now,
        ],
      );
    }
    return items.length;
  }

  private importMisconceptions(packVersion: string, file: PackFile): number {
    const items = this.readItems(file);
    const now = new Date().toISOString();
    for (const item of items) {
      this.db.run(
        `INSERT INTO curriculum_misconceptions (
           misconception_id, title, domain, observable_sign, possible_causes_json,
           random_vs_systematic, first_question, first_hint, second_hint,
           prerequisite_to_check, retry_task_rule, forbidden_inference,
           source_pack_version, source_path, content_hash, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(misconception_id) DO UPDATE SET
           title = excluded.title,
           domain = excluded.domain,
           observable_sign = excluded.observable_sign,
           possible_causes_json = excluded.possible_causes_json,
           random_vs_systematic = excluded.random_vs_systematic,
           first_question = excluded.first_question,
           first_hint = excluded.first_hint,
           second_hint = excluded.second_hint,
           prerequisite_to_check = excluded.prerequisite_to_check,
           retry_task_rule = excluded.retry_task_rule,
           forbidden_inference = excluded.forbidden_inference,
           source_pack_version = excluded.source_pack_version,
           source_path = excluded.source_path,
           content_hash = excluded.content_hash,
           updated_at = excluded.updated_at`,
        [
          this.stringValue(item.misconception_id),
          this.stringValue(item.title),
          this.stringValue(item.domain),
          this.stringValue(item.observable_sign),
          JSON.stringify(this.arrayValue(item.possible_causes)),
          this.stringValue(item.random_vs_systematic),
          this.stringValue(item.first_question),
          this.stringValue(item.first_hint),
          this.stringValue(item.second_hint),
          this.optionalString(item.prerequisite_to_check),
          this.stringValue(item.retry_task_rule),
          this.stringValue(item.forbidden_inference),
          packVersion,
          file.relativePath,
          file.contentHash,
          now,
          now,
        ],
      );
    }
    return items.length;
  }

  private importTaskBankIndex(packVersion: string, file: PackFile): number {
    const parsed = this.readJson(file);
    this.upsertSourceFile({
      sourcePackVersion: packVersion,
      relativePath: file.relativePath,
      targetKind: 'metadata',
      contentHash: file.contentHash,
      sizeBytes: file.sizeBytes,
      status: 'imported',
      metadata: parsed,
    });
    return 1;
  }

  private importTaskBank(packVersion: string, file: PackFile): number {
    const lines = file.buffer
      .toString('utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const now = new Date().toISOString();
    for (const line of lines) {
      const item = JSON.parse(line) as JsonObject;
      this.db.run(
        `INSERT INTO task_bank_tasks (
           task_id, topic_id, skill_id, task_type_id, difficulty, prompt,
           expected_answer, solution_steps_json, common_errors_json,
           hint_ladder_json, verifier_kind, source_type, verification_json,
           task_bank_file, source_pack_version, source_path, content_hash,
           created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(task_id) DO UPDATE SET
           topic_id = excluded.topic_id,
           skill_id = excluded.skill_id,
           task_type_id = excluded.task_type_id,
           difficulty = excluded.difficulty,
           prompt = excluded.prompt,
           expected_answer = excluded.expected_answer,
           solution_steps_json = excluded.solution_steps_json,
           common_errors_json = excluded.common_errors_json,
           hint_ladder_json = excluded.hint_ladder_json,
           verifier_kind = excluded.verifier_kind,
           source_type = excluded.source_type,
           verification_json = excluded.verification_json,
           task_bank_file = excluded.task_bank_file,
           source_pack_version = excluded.source_pack_version,
           source_path = excluded.source_path,
           content_hash = excluded.content_hash,
           updated_at = excluded.updated_at`,
        [
          this.stringValue(item.task_id),
          this.stringValue(item.topic_id),
          this.stringValue(item.skill_id),
          this.stringValue(item.task_type_id),
          this.stringValue(item.difficulty),
          this.stringValue(item.prompt),
          this.stringValue(item.expected_answer),
          JSON.stringify(this.arrayValue(item.solution_steps)),
          JSON.stringify(this.arrayValue(item.common_errors)),
          JSON.stringify(this.arrayValue(item.hint_ladder)),
          this.stringValue(item.verifier_kind),
          this.stringValue(item.source_type),
          JSON.stringify(this.objectValue(item.verification)),
          basename(file.relativePath),
          packVersion,
          file.relativePath,
          file.contentHash,
          now,
          now,
        ],
      );
    }
    return lines.length;
  }

  private importErrorClassification(packVersion: string, file: PackFile): number {
    const parsed = this.readJson(file);
    const now = new Date().toISOString();
    let count = 0;
    for (const errorKind of this.arrayValue(parsed.error_kinds)) {
      this.upsertErrorClassificationEntry(packVersion, file, now, 'error_kind', String(errorKind), {
        value: errorKind,
      });
      count += 1;
    }
    for (const level of this.arrayObjects(parsed.classification_levels)) {
      const key = this.stringValue(level.level);
      this.upsertErrorClassificationEntry(packVersion, file, now, 'classification_level', key, level);
      count += 1;
    }
    for (const misconceptionId of this.arrayValue(parsed.misconception_ids)) {
      this.upsertErrorClassificationEntry(
        packVersion,
        file,
        now,
        'misconception_id',
        String(misconceptionId),
        { value: misconceptionId },
      );
      count += 1;
    }
    for (const [key, value] of Object.entries(this.objectValue(parsed.global_constraints))) {
      this.upsertErrorClassificationEntry(
        packVersion,
        file,
        now,
        'global_constraint',
        key,
        { value },
      );
      count += 1;
    }
    return count;
  }

  private importLessonTypePlan(packVersion: string, file: PackFile): number {
    const parsed = this.readJson(file);
    const phases = this.arrayObjects(parsed.phases);
    const now = new Date().toISOString();
    for (const phase of phases) {
      this.db.run(
        `INSERT INTO lesson_type_plans (
           phase, goal, recommended_lesson_mix_json, transition_criteria_json,
           minimum_evidence, reflection_frequency, review_frequency,
           mock_exam_place, prerequisite_return_rule, source_pack_version,
           source_path, content_hash, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(phase) DO UPDATE SET
           goal = excluded.goal,
           recommended_lesson_mix_json = excluded.recommended_lesson_mix_json,
           transition_criteria_json = excluded.transition_criteria_json,
           minimum_evidence = excluded.minimum_evidence,
           reflection_frequency = excluded.reflection_frequency,
           review_frequency = excluded.review_frequency,
           mock_exam_place = excluded.mock_exam_place,
           prerequisite_return_rule = excluded.prerequisite_return_rule,
           source_pack_version = excluded.source_pack_version,
           source_path = excluded.source_path,
           content_hash = excluded.content_hash,
           updated_at = excluded.updated_at`,
        [
          this.stringValue(phase.phase),
          this.stringValue(phase.goal),
          JSON.stringify(this.objectValue(phase.recommended_lesson_mix)),
          JSON.stringify(this.arrayValue(phase.transition_criteria)),
          this.stringValue(phase.minimum_evidence),
          this.stringValue(phase.reflection_frequency),
          this.stringValue(phase.review_frequency),
          this.stringValue(phase.mock_exam_place),
          this.stringValue(phase.prerequisite_return_rule),
          packVersion,
          file.relativePath,
          file.contentHash,
          now,
          now,
        ],
      );
    }
    return phases.length;
  }

  private upsertPrerequisiteEdge(
    packVersion: string,
    file: PackFile,
    now: string,
    edgeType: 'topic' | 'skill',
    edge: JsonObject,
  ): void {
    const fromId =
      edgeType === 'topic'
        ? this.stringValue(edge.from_topic_id)
        : this.stringValue(edge.from_skill_id);
    const toId =
      edgeType === 'topic' ? this.stringValue(edge.to_topic_id) : this.stringValue(edge.to_skill_id);
    this.db.run(
      `INSERT INTO curriculum_prerequisite_edges (
         id, edge_type, from_id, to_id, relation, source_pack_version,
         source_path, content_hash, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(edge_type, from_id, to_id, relation) DO UPDATE SET
         source_pack_version = excluded.source_pack_version,
         source_path = excluded.source_path,
         content_hash = excluded.content_hash,
         updated_at = excluded.updated_at`,
      [
        randomUUID(),
        edgeType,
        fromId,
        toId,
        this.stringValue(edge.relation),
        packVersion,
        file.relativePath,
        file.contentHash,
        now,
        now,
      ],
    );
  }

  private upsertErrorClassificationEntry(
    packVersion: string,
    file: PackFile,
    now: string,
    entryType: string,
    entryKey: string,
    entryJson: JsonObject,
  ): void {
    this.db.run(
      `INSERT INTO error_classification_entries (
         id, entry_type, entry_key, entry_json, source_pack_version,
         source_path, content_hash, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(entry_type, entry_key) DO UPDATE SET
         entry_json = excluded.entry_json,
         source_pack_version = excluded.source_pack_version,
         source_path = excluded.source_path,
         content_hash = excluded.content_hash,
         updated_at = excluded.updated_at`,
      [
        randomUUID(),
        entryType,
        entryKey,
        JSON.stringify(entryJson),
        packVersion,
        file.relativePath,
        file.contentHash,
        now,
        now,
      ],
    );
  }

  private upsertSourceFile(input: SourceFileStateInput): void {
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO knowledge_source_files (
         id, source_pack_version, relative_path, target_kind, content_hash,
         size_bytes, status, knowledge_file_id, metadata_json, error_message,
         created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_pack_version, relative_path, target_kind) DO UPDATE SET
         content_hash = excluded.content_hash,
         size_bytes = excluded.size_bytes,
         status = excluded.status,
         knowledge_file_id = excluded.knowledge_file_id,
         metadata_json = excluded.metadata_json,
         error_message = excluded.error_message,
         updated_at = excluded.updated_at`,
      [
        randomUUID(),
        input.sourcePackVersion,
        input.relativePath,
        input.targetKind,
        input.contentHash,
        input.sizeBytes,
        input.status,
        input.knowledgeFileId ?? null,
        JSON.stringify(input.metadata),
        input.errorMessage ?? null,
        now,
        now,
      ],
    );
  }

  private insertImportLedger(input: {
    packVersion: string;
    rootPath: string;
    importKind: 'structured' | 'rag' | 'structured_and_rag';
    status: 'completed' | 'failed';
    structuredFileCount: number;
    ragFileCount: number;
    importedRowCount: number;
    uploadedFileCount: number;
    skippedFileCount: number;
    errorMessage?: string;
  }): void {
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO knowledge_pack_imports (
         id, pack_version, root_path, import_kind, status, structured_file_count,
         rag_file_count, imported_row_count, uploaded_file_count, skipped_file_count,
         error_message, started_at, completed_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        input.packVersion,
        input.rootPath,
        input.importKind,
        input.status,
        input.structuredFileCount,
        input.ragFileCount,
        input.importedRowCount,
        input.uploadedFileCount,
        input.skippedFileCount,
        input.errorMessage ?? null,
        now,
        now,
      ],
    );
  }

  private isAlreadyImported(packVersion: string, file: PackFile): boolean {
    const existing = this.db.get<{ content_hash: string; status: string }>(
      `SELECT content_hash, status
       FROM knowledge_source_files
       WHERE source_pack_version = ?
         AND relative_path = ?
         AND target_kind = 'db_structured'`,
      [packVersion, file.relativePath],
    );
    return existing?.content_hash === file.contentHash && existing.status === 'imported';
  }

  private detectPackVersion(rootPath: string): string {
    const manifest = this.readPackFile(rootPath, 'rag-corpus/rag-manifest.json');
    if (!manifest) {
      return 'unknown';
    }
    const parsed = this.readJson(manifest);
    const schemaVersion = this.optionalString(parsed.schema_version);
    return schemaVersion ? `v${schemaVersion}` : 'unknown';
  }

  private normalizePackRoot(path: string): string {
    const absolute = resolve(path);
    if (existsSync(join(absolute, 'rag-corpus'))) {
      return absolute;
    }
    const children = readdirSync(absolute, { withFileTypes: true }).filter((entry) =>
      entry.isDirectory(),
    );
    const matching = children
      .map((entry) => join(absolute, entry.name))
      .find((child) => existsSync(join(child, 'rag-corpus')));
    if (!matching) {
      throw new BadRequestException('Knowledge pack root must contain rag-corpus/');
    }
    return matching;
  }

  private scanPackFiles(rootPath: string): PackFile[] {
    const files: PackFile[] = [];
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const absolutePath = join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(absolutePath);
          continue;
        }
        if (!entry.isFile()) {
          continue;
        }
        const buffer = readFileSync(absolutePath);
        files.push({
          absolutePath,
          relativePath: this.toRelativePath(rootPath, absolutePath),
          buffer,
          contentHash: this.sha256(buffer),
          sizeBytes: buffer.length,
        });
      }
    };
    walk(rootPath);
    return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  }

  private readPackFile(rootPath: string, relativePath: string): PackFile | undefined {
    const absolutePath = join(rootPath, ...relativePath.split('/'));
    if (!existsSync(absolutePath)) {
      return undefined;
    }
    const buffer = readFileSync(absolutePath);
    return {
      absolutePath,
      relativePath,
      buffer,
      contentHash: this.sha256(buffer),
      sizeBytes: buffer.length,
    };
  }

  private isStudentRagFile(file: PackFile): boolean {
    if (!file.relativePath.endsWith('.md')) {
      return false;
    }
    if (file.relativePath.startsWith('rag-corpus/01-exam-framework/')) {
      return true;
    }
    if (file.relativePath === 'rag-corpus/02-curriculum/curriculum-overview.md') {
      return true;
    }
    if (file.relativePath.startsWith('rag-corpus/03-theory/')) {
      return true;
    }
    if (file.relativePath.startsWith('rag-corpus/05-misconceptions/')) {
      return true;
    }
    if (file.relativePath.startsWith('rag-corpus/06-teaching-methods/')) {
      return true;
    }
    if (file.relativePath.startsWith('rag-corpus/07-teen-communication/')) {
      return true;
    }
    if (file.relativePath.startsWith('rag-corpus/08-lesson-types/')) {
      return true;
    }
    if (file.relativePath.startsWith('rag-corpus/09-lesson-scenarios/')) {
      return true;
    }
    if (/^learning-plans\/plan-.+\.md$/.test(file.relativePath)) {
      return true;
    }
    return (
      file.relativePath === 'learning-plans/student-plan-generation-rules.md' ||
      file.relativePath === 'learning-plans/student-plan-update-rules.md'
    );
  }

  private readJson(file: PackFile): JsonObject {
    return JSON.parse(file.buffer.toString('utf8')) as JsonObject;
  }

  private readItems(file: PackFile): JsonObject[] {
    return this.arrayObjects(this.readJson(file).items);
  }

  private toRelativePath(rootPath: string, absolutePath: string): string {
    return relative(rootPath, absolutePath).split(sep).join('/');
  }

  private sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
  }

  private optionalString(value: unknown): string | null {
    const text = this.stringValue(value);
    return text.length > 0 ? text : null;
  }

  private optionalNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private booleanInt(value: unknown): number {
    return value === true ? 1 : 0;
  }

  private objectValue(value: unknown): JsonObject {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private arrayValue(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private arrayObjects(value: unknown): JsonObject[] {
    return this.arrayValue(value).filter(
      (item): item is JsonObject => item !== null && typeof item === 'object' && !Array.isArray(item),
    );
  }
}
