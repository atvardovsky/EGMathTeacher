declare module 'node:sqlite' {
  export interface StatementResultingChanges {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export interface StatementSync {
    run(...params: unknown[]): StatementResultingChanges;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Array<Record<string, unknown>>;
  }

  export class DatabaseSync {
    constructor(location?: string);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
