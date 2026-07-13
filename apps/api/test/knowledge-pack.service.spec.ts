import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { DatabaseService } from '../src/database/database.service';
import { KnowledgePackService } from '../src/knowledge/knowledge-pack.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';

function createConfig(sqlitePath: string): ConfigService {
  const values: Record<string, unknown> = {
    'app.sqlitePath': sqlitePath,
    'app.knowledgeRagIndexWaitAttempts': 2,
    'app.knowledgeRagIndexWaitDelayMs': 1,
    'ai.openai.vectorStoreIds': [],
  };
  return {
    get: <T>(key: string) => values[key] as T,
  } as ConfigService;
}

function writeText(root: string, relativePath: string, content: string): void {
  const absolutePath = join(root, ...relativePath.split('/'));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function writeJson(root: string, relativePath: string, content: unknown): void {
  writeText(root, relativePath, `${JSON.stringify(content, null, 2)}\n`);
}

function createPackRoot(): string {
  const root = join(tmpdir(), `egmathteacher-knowledge-pack-${randomUUID()}`);
  mkdirSync(root, { recursive: true });
  writeJson(root, 'rag-corpus/rag-manifest.json', {
    pack_version: 'v1.0',
    schema_version: '1.0',
    content_release: 'fixture-release',
    generated_at: '2026-01-01T00:00:00.000Z',
    project: 'EGMathTeacher',
  });
  return root;
}

describe('KnowledgePackService', () => {
  let db: DatabaseService;
  let root: string;
  let knowledgeService: KnowledgeService;
  let packService: KnowledgePackService;
  let aiModel: {
    createVectorStore: jest.Mock;
    uploadFile: jest.Mock;
    attachFileToVectorStore: jest.Mock;
    removeFileFromVectorStore: jest.Mock;
    listVectorStoreFiles: jest.Mock;
  };

  beforeEach(() => {
    const sqlitePath = join(tmpdir(), `egmathteacher-knowledge-${randomUUID()}.sqlite`);
    db = new DatabaseService(createConfig(sqlitePath));
    root = createPackRoot();
    aiModel = {
      createVectorStore: jest.fn(async () => ({ id: 'vs_1' })),
      uploadFile: jest
        .fn()
        .mockResolvedValueOnce({ id: 'file_1' })
        .mockResolvedValueOnce({ id: 'file_2' }),
      attachFileToVectorStore: jest.fn(async () => ({ status: 'completed' })),
      removeFileFromVectorStore: jest.fn(async () => ({ deleted: true })),
      listVectorStoreFiles: jest.fn(async () => ({ data: [] })),
    };
    knowledgeService = new KnowledgeService(db, createConfig(sqlitePath), aiModel as any);
    packService = new KnowledgePackService(db, knowledgeService);
  });

  afterEach(() => {
    db.onModuleDestroy();
    rmSync(root, { recursive: true, force: true });
  });

  it('imports structured curriculum and task-bank files into SQLite', () => {
    writeStructuredFixture(root);

    const summary = packService.importStructured({ rootPath: root });

    expect(summary.packVersion).toBe('v1.0');
    expect(summary.structuredFiles).toBeGreaterThanOrEqual(9);
    expect(summary.importedRows).toBeGreaterThan(0);
    expect(
      db.get<{ title: string }>(
        'SELECT title FROM curriculum_topics WHERE topic_id = ?',
        ['algebra.linear_equations'],
      ),
    ).toEqual({ title: 'Линейные уравнения' });
    expect(
      db.get<{ skill_title: string; verifier_kind: string }>(
        'SELECT skill_title, verifier_kind FROM curriculum_skills WHERE skill_id = ?',
        ['algebra.linear.solve_one_variable'],
      ),
    ).toEqual({
      skill_title: 'Решение линейного уравнения',
      verifier_kind: 'linear_equation_numeric',
    });
    expect(
      db.get<{ verifier_kind: string }>(
        'SELECT verifier_kind FROM task_bank_tasks WHERE task_id = ?',
        ['task.arithmetic.1'],
      ),
    ).toEqual({ verifier_kind: 'numeric' });
    expect(
      db.get<{ prompt: string }>('SELECT prompt FROM task_bank_tasks WHERE task_id = ?', [
        'task.linear.1',
      ]),
    ).toEqual({ prompt: 'Реши уравнение: 2x + 3 = 15.' });

    const second = packService.importStructured({ rootPath: root });
    expect(second.importedRows).toBe(0);
    expect(second.skippedFiles).toBe(summary.structuredFiles);
  });

  it('syncs RAG Markdown by content hash and replaces changed files', async () => {
    writeText(root, 'rag-corpus/03-theory/linear-equations.md', '# Linear equations\n');

    const dryRun = await packService.syncStudentRag({ rootPath: root, dryRun: true });
    expect(dryRun.results).toEqual([
      expect.objectContaining({
        action: 'would_upload',
        vectorStoreId: 'would_create_vector_store',
      }),
    ]);
    expect(aiModel.createVectorStore).not.toHaveBeenCalled();
    expect(aiModel.uploadFile).not.toHaveBeenCalled();

    const first = await packService.syncStudentRag({ rootPath: root });
    expect(first.uploadedFiles).toBe(1);
    expect(first.skippedFiles).toBe(0);
    expect(aiModel.createVectorStore).toHaveBeenCalledTimes(1);
    expect(aiModel.uploadFile).toHaveBeenCalledTimes(1);
    expect(knowledgeService.getActiveVectorStoreIds()).toEqual(['vs_1']);

    const second = await packService.syncStudentRag({ rootPath: root });
    expect(second.uploadedFiles).toBe(0);
    expect(second.skippedFiles).toBe(1);
    expect(aiModel.uploadFile).toHaveBeenCalledTimes(1);

    writeText(root, 'rag-corpus/03-theory/linear-equations.md', '# Linear equations\nupdated\n');
    const third = await packService.syncStudentRag({ rootPath: root });

    expect(third.replacedFiles).toBe(1);
    expect(aiModel.uploadFile).toHaveBeenCalledTimes(2);
    expect(aiModel.removeFileFromVectorStore).toHaveBeenCalledWith('vs_1', 'file_1');
    expect(
      db.get<{ sync_status: string }>(
        'SELECT sync_status FROM knowledge_files WHERE openai_file_id = ?',
        ['file_1'],
      ),
    ).toEqual({ sync_status: 'superseded' });
    expect(
      db.get<{ sync_status: string }>(
        'SELECT sync_status FROM knowledge_files WHERE openai_file_id = ?',
        ['file_2'],
      ),
    ).toEqual({ sync_status: 'active' });

    rmSync(join(root, 'rag-corpus/03-theory/linear-equations.md'));
    const fourth = await packService.syncStudentRag({ rootPath: root });

    expect(fourth.retiredFiles).toBe(1);
    expect(aiModel.removeFileFromVectorStore).toHaveBeenCalledWith('vs_1', 'file_2');
    expect(
      db.get<{ sync_status: string }>(
        'SELECT sync_status FROM knowledge_files WHERE openai_file_id = ?',
        ['file_2'],
      ),
    ).toEqual({ sync_status: 'superseded' });
  });

  it('does not reconcile removed RAG files when sync runs in partial mode', async () => {
    writeText(root, 'rag-corpus/03-theory/linear-equations.md', '# Linear equations\n');

    await packService.syncStudentRag({ rootPath: root });
    rmSync(join(root, 'rag-corpus/03-theory/linear-equations.md'));

    const partial = await packService.syncKnowledgePack({
      rootPath: root,
      syncRag: true,
      importMode: 'partial',
    });

    expect(partial.rag?.retiredFiles).toBe(0);
    expect(aiModel.removeFileFromVectorStore).not.toHaveBeenCalled();
    expect(
      db.get<{ sync_status: string }>(
        'SELECT sync_status FROM knowledge_files WHERE openai_file_id = ?',
        ['file_1'],
      ),
    ).toEqual({ sync_status: 'active' });
  });

  it('keeps wait-ready jobs attached when vector indexing does not complete', async () => {
    writeText(root, 'rag-corpus/03-theory/linear-equations.md', '# Linear equations\n');
    aiModel.listVectorStoreFiles.mockResolvedValue({
      data: [{ id: 'file_1', status: 'queued' }],
    });

    await packService.syncStudentRag({ rootPath: root, waitUntilIndexed: true });

    const job = db.get<{ status: string; metadata_json: string }>(
      'SELECT status, metadata_json FROM knowledge_pack_sync_jobs LIMIT 1',
    );
    const metadata = JSON.parse(job?.metadata_json ?? '{}') as Record<string, unknown>;
    expect(job?.status).toBe('attached');
    expect(metadata.status).toBe('queued');
    expect(metadata.indexWaitTimedOut).toBe(true);
    expect(
      db.get<{ status: string; sync_status: string }>(
        'SELECT status, sync_status FROM knowledge_files WHERE openai_file_id = ?',
        ['file_1'],
      ),
    ).toEqual({ status: 'queued', sync_status: 'indexing' });
    expect(
      db.get<{ status: string }>(
        'SELECT status FROM knowledge_source_files WHERE relative_path = ?',
        ['rag-corpus/03-theory/linear-equations.md'],
      ),
    ).toEqual({ status: 'pending' });
  });

  it('keeps no-wait RAG sync rows indexing when attach status is still queued', async () => {
    writeText(root, 'rag-corpus/03-theory/linear-equations.md', '# Linear equations\n');
    aiModel.attachFileToVectorStore.mockResolvedValueOnce({ status: 'queued' });

    const summary = await packService.syncStudentRag({
      rootPath: root,
      waitUntilIndexed: false,
    });

    expect(summary.results[0]).toEqual(
      expect.objectContaining({
        action: 'uploaded_pending_index',
        openAiFileId: 'file_1',
      }),
    );
    expect(
      db.get<{ status: string; sync_status: string }>(
        'SELECT status, sync_status FROM knowledge_files WHERE openai_file_id = ?',
        ['file_1'],
      ),
    ).toEqual({ status: 'queued', sync_status: 'indexing' });
    expect(
      db.get<{ status: string }>(
        'SELECT status FROM knowledge_pack_sync_jobs WHERE source_path = ?',
        ['rag-corpus/03-theory/linear-equations.md'],
      ),
    ).toEqual({ status: 'attached' });
  });

  it('promotes pending indexed RAG files only after recovery sees completed indexing', async () => {
    writeText(root, 'rag-corpus/03-theory/linear-equations.md', '# Linear equations\n');
    aiModel.listVectorStoreFiles.mockResolvedValue({
      data: [{ id: 'file_1', status: 'completed' }],
    });
    await packService.syncStudentRag({ rootPath: root, waitUntilIndexed: true });

    writeText(root, 'rag-corpus/03-theory/linear-equations.md', '# Linear equations\nupdated\n');
    aiModel.listVectorStoreFiles.mockResolvedValue({
      data: [{ id: 'file_2', status: 'queued' }],
    });
    const pending = await packService.syncStudentRag({
      rootPath: root,
      waitUntilIndexed: true,
    });

    expect(pending.results[0]).toEqual(
      expect.objectContaining({
        action: 'replaced_pending_index',
        supersededCount: 0,
      }),
    );
    expect(aiModel.removeFileFromVectorStore).not.toHaveBeenCalledWith('vs_1', 'file_1');
    expect(
      db.get<{ sync_status: string }>(
        'SELECT sync_status FROM knowledge_files WHERE openai_file_id = ?',
        ['file_1'],
      ),
    ).toEqual({ sync_status: 'active' });
    expect(
      db.get<{ sync_status: string }>(
        'SELECT sync_status FROM knowledge_files WHERE openai_file_id = ?',
        ['file_2'],
      ),
    ).toEqual({ sync_status: 'indexing' });

    const noWaitRecovery = await knowledgeService.recoverFailedRagSyncJobs(false);

    expect(noWaitRecovery).toEqual({ recovered: 0, failed: 1 });
    expect(aiModel.removeFileFromVectorStore).not.toHaveBeenCalledWith('vs_1', 'file_1');
    expect(
      db.get<{ sync_status: string }>(
        'SELECT sync_status FROM knowledge_files WHERE openai_file_id = ?',
        ['file_1'],
      ),
    ).toEqual({ sync_status: 'active' });
    expect(
      db.get<{ sync_status: string; status: string }>(
        'SELECT sync_status, status FROM knowledge_files WHERE openai_file_id = ?',
        ['file_2'],
      ),
    ).toEqual({ sync_status: 'indexing', status: 'queued' });

    aiModel.listVectorStoreFiles.mockResolvedValue({
      data: [{ id: 'file_2', status: 'completed' }],
    });
    const recovered = await knowledgeService.recoverFailedRagSyncJobs(true);

    expect(recovered).toEqual({ recovered: 1, failed: 0 });
    expect(aiModel.removeFileFromVectorStore).toHaveBeenCalledWith('vs_1', 'file_1');
    expect(
      db.get<{ sync_status: string }>(
        'SELECT sync_status FROM knowledge_files WHERE openai_file_id = ?',
        ['file_1'],
      ),
    ).toEqual({ sync_status: 'superseded' });
    expect(
      db.get<{ sync_status: string; status: string }>(
        'SELECT sync_status, status FROM knowledge_files WHERE openai_file_id = ?',
        ['file_2'],
      ),
    ).toEqual({ sync_status: 'active', status: 'completed' });
  });

  it('fails strict imports for incomplete packs and records failed sync attempts', async () => {
    await expect(
      packService.syncKnowledgePack({ rootPath: root, importDb: true }),
    ).rejects.toThrow('Knowledge pack validation failed');

    expect(
      db.get<{ status: string; error_message: string }>(
        'SELECT status, error_message FROM knowledge_pack_imports ORDER BY started_at DESC LIMIT 1',
      ),
    ).toEqual(
      expect.objectContaining({
        status: 'failed',
        error_message: expect.stringContaining('Knowledge pack validation failed'),
      }),
    );

    const partial = await packService.syncKnowledgePack({
      rootPath: root,
      importDb: true,
      importMode: 'partial',
    });
    expect(partial.structured?.warnings.length).toBeGreaterThan(0);
    expect(
      db.get<{ status: string }>(
        'SELECT status FROM knowledge_pack_imports ORDER BY started_at DESC LIMIT 1',
      ),
    ).toEqual({ status: 'completed' });
  });
});

function writeStructuredFixture(root: string): void {
  writeJson(root, 'rag-corpus/02-curriculum/curriculum-topics.json', {
    items: [
      {
        topic_id: 'algebra.linear_equations',
        title: 'Линейные уравнения',
        exam_track: 'base',
        prerequisite_topic_ids: [],
        skill_ids: ['algebra.linear.solve_one_variable'],
        theory_document_id: 'theory.linear',
        status: 'ready',
      },
      {
        topic_id: 'arithmetic.numbers_and_calculations',
        title: 'Числа и вычисления',
        exam_track: 'base',
        prerequisite_topic_ids: [],
        skill_ids: ['arithmetic.numbers.operations'],
        theory_document_id: 'theory.arithmetic',
        status: 'ready',
      },
    ],
  });
  writeJson(root, 'rag-corpus/02-curriculum/curriculum-task-types.json', {
    items: [
      {
        task_type_id: 'ege.base.linear_equation_numeric',
        title: 'Линейное уравнение с числовым ответом',
        exam_track: 'base',
        response_kind: 'short_numeric',
        runtime_verifier_kind: 'linear_equation_numeric',
        planned_verifier_kind: 'linear_equation_numeric',
        year_binding: 'fixture',
      },
      {
        task_type_id: 'ege.base.arithmetic_numeric',
        title: 'Числовые вычисления',
        exam_track: 'base',
        response_kind: 'short_numeric',
        runtime_verifier_kind: 'unsupported',
        planned_verifier_kind: 'numeric',
        year_binding: 'fixture',
      },
    ],
  });
  writeJson(root, 'rag-corpus/02-curriculum/curriculum-skills.json', {
    items: [
      {
        skill_id: 'algebra.linear.solve_one_variable',
        title: 'Решение линейного уравнения',
        topic_id: 'algebra.linear_equations',
        description: 'Решает ax+b=c.',
        prerequisites: [],
        task_type_ids: ['ege.base.linear_equation_numeric'],
        typical_misconceptions: ['sign_error'],
        explanation_methods: ['worked_example'],
        minimum_mastery_criterion: 'Two verified attempts.',
        verification_methods: ['deterministic'],
        recommended_lesson_type: 'practice',
        deterministic_verification: 'runtime',
        difficulty: 'foundation',
        estimated_learning_minutes: 30,
      },
      {
        skill_id: 'arithmetic.numbers.operations',
        title: 'Порядок действий',
        topic_id: 'arithmetic.numbers_and_calculations',
        description: 'Выполняет числовые вычисления.',
        prerequisites: [],
        task_type_ids: ['ege.base.arithmetic_numeric'],
        typical_misconceptions: ['sign_error'],
        explanation_methods: ['worked_example'],
        minimum_mastery_criterion: 'Practice with checked examples.',
        verification_methods: ['planned_numeric'],
        recommended_lesson_type: 'practice',
        deterministic_verification: 'planned',
        difficulty: 'foundation',
        estimated_learning_minutes: 20,
      },
    ],
  });
  writeJson(root, 'rag-corpus/02-curriculum/curriculum-prerequisites.json', {
    topic_edges: [],
    skill_edges: [],
  });
  writeJson(root, 'rag-corpus/02-curriculum/curriculum-mastery-criteria.json', {
    items: [
      {
        skill_id: 'algebra.linear.solve_one_variable',
        minimum_criterion: 'Two verified attempts.',
        required_evidence_sequence: ['attempt_submitted', 'deterministically_verified'],
        self_report_can_complete: false,
        single_success_can_complete: false,
        recommended_recheck_days: [2, 7],
        regression_trigger: 'Two misses after success.',
      },
    ],
  });
  writeJson(root, 'rag-corpus/02-curriculum/curriculum-misconceptions.json', {
    items: [
      {
        misconception_id: 'sign_error',
        title: 'Ошибка со знаком',
        observable_sign: 'Меняет знак при переносе.',
        possible_causes: ['weak inverse operation'],
        random_vs_systematic: 'Check twice.',
        first_question: 'Что изменилось при переносе?',
        first_hint: 'Проверь обратную операцию.',
        second_hint: 'Подставь ответ обратно.',
        prerequisite_to_check: 'arithmetic.numbers.operations',
        retry_task_rule: 'Give isomorphic equation.',
        forbidden_inference: 'Do not infer ability from one mistake.',
        domain: 'algebra',
      },
    ],
  });
  writeJson(root, 'rag-corpus/04-task-bank/task-bank-index.json', {
    total_tasks: 1,
    files: [{ path: 'tasks-base.jsonl', purpose: 'fixture', count: 1 }],
  });
  writeText(
    root,
    'rag-corpus/04-task-bank/tasks-base.jsonl',
    `${JSON.stringify({
      task_id: 'task.linear.1',
      topic_id: 'algebra.linear_equations',
      skill_id: 'algebra.linear.solve_one_variable',
      task_type_id: 'ege.base.linear_equation_numeric',
      difficulty: 'base',
      prompt: 'Реши уравнение: 2x + 3 = 15.',
      expected_answer: '6',
      solution_steps: ['2x=12', 'x=6'],
      common_errors: ['sign_error'],
      hint_ladder: ['Перенеси 3.', 'Раздели на 2.'],
      verifier_kind: 'linear_equation_numeric',
      source_type: 'fixture',
      verification: { status: 'checked' },
    })}\n`,
  );
  writeText(
    root,
    'rag-corpus/04-task-bank/tasks-diagnostic.jsonl',
    `${JSON.stringify({
      task_id: 'task.arithmetic.1',
      topic_id: 'arithmetic.numbers_and_calculations',
      skill_id: 'arithmetic.numbers.operations',
      task_type_id: 'ege.base.arithmetic_numeric',
      difficulty: 'base',
      prompt: 'Вычислите: 48 - 3 * (7 - 2).',
      expected_answer: '33',
      solution_steps: ['7 - 2 = 5', '3 * 5 = 15', '48 - 15 = 33'],
      common_errors: ['sign_error'],
      hint_ladder: ['Начните со скобок.', 'Затем выполните умножение.'],
      verifier_kind: 'numeric',
      source_type: 'fixture',
      verification: { status: 'checked' },
    })}\n`,
  );
  for (const taskFile of ['tasks-profile.jsonl', 'tasks-retry.jsonl', 'tasks-review.jsonl']) {
    writeText(root, `rag-corpus/04-task-bank/${taskFile}`, '');
  }
  writeJson(root, 'rag-corpus/05-misconceptions/error-classification.json', {
    error_kinds: ['calculation_slip'],
    classification_levels: [
      {
        level: 'observation',
        definition: 'One error.',
        minimum_evidence: 1,
        allowed_action: 'ask_one_question',
      },
    ],
    misconception_ids: ['sign_error'],
    global_constraints: ['No labels from one mistake.', 'Sensitive data must not be recorded.'],
  });
  writeJson(root, 'learning-plans/lesson-type-plan.json', {
    phases: [
      {
        phase: 'onboarding',
        goal: 'Understand the student goal.',
        recommended_lesson_mix: { meeting: 8 },
        transition_criteria: ['goal_recorded'],
        minimum_evidence: 'agent_interpreted',
        reflection_frequency: 'each contact',
        review_frequency: 'none',
        mock_exam_place: 'none',
        prerequisite_return_rule: 'record unknown',
      },
    ],
  });
}
