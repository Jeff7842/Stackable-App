export type Row = { id: string; schoolId: string };

/** An array value means "any of"; null means IS NULL. */
export type Where<T> = { [K in keyof T]?: T[K] | T[K][] };

export const DEFAULT_FIND_LIMIT = 500; // every list is bounded

export interface FindOptions<T> {
  limit?: number;
  orderBy?: keyof T & string;
  /** Rows whose column is strictly before the given value. */
  lt?: Partial<T>;
}

export type NewRow<T> = Omit<T, "id" | "schoolId" | "createdAt" | "updatedAt"> & { id?: string };

/** One tenant's view of one table; the school is fixed by the transaction that created it. */
export interface Repo<T extends Row> {
  insert(row: NewRow<T>): Promise<T>;
  get(id: string): Promise<T | undefined>;
  getMany(ids: string[]): Promise<T[]>;
  find(where?: Where<T>, opts?: FindOptions<T>): Promise<T[]>;
  update(id: string, patch: Partial<T>): Promise<T | undefined>;
  updateMany(where: Where<T>, patch: Partial<T>): Promise<number>;
}

export interface TableDef<T extends Row> {
  name: string;
  keys: readonly (keyof T & string)[];
  json: readonly (keyof T & string)[];
  /** Phantom field that carries the row type. */
  readonly _row?: T;
}

export interface OutboxRow {
  id: string;
  schoolId: string;
  topic: string;
  payload: Record<string, unknown>;
  createdAt: string;
  publishedAt: string | null;
}
