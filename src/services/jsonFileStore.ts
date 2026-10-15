/** File access is injected so failure and recovery tests never touch user data. */
export interface JsonFileAccess {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, contents: string): Promise<void>;
  copy(source: string, destination: string): Promise<void>;
  rename(source: string, destination: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export class DataFileError extends Error {
  readonly code: 'READ_FAILED' | 'INVALID_DATA' | 'RECOVERY_REQUIRED' | 'WRITE_FAILED';
  readonly path: string;
  constructor(
    code: DataFileError['code'],
    path: string,
  ) {
    super(`${code}: ${path}`);
    this.name = 'DataFileError';
    this.code = code;
    this.path = path;
  }
}

export type JsonRead<T> = { status: 'missing' } | { status: 'ready'; value: T };
export type JsonDecoder<T> = (value: unknown) => T;

/** Serializes this WebView's access. Cross-process locking is a separate backend task. */
export class JsonFileStore {
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly files: JsonFileAccess;

  constructor(files: JsonFileAccess) { this.files = files; }

  private enqueue<T>(path: string, action: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(path) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(action);
    this.queues.set(path, operation);
    void operation.finally(() => {
      if (this.queues.get(path) === operation) this.queues.delete(path);
    }).catch(() => undefined);
    return operation;
  }

  private async readNow<T>(path: string, decode: JsonDecoder<T>): Promise<JsonRead<T>> {
    try {
      if (!await this.files.exists(path)) {
        for (const suffix of ['.bak', '.tmp', '.bak.tmp']) {
          if (await this.files.exists(path + suffix)) {
            throw new DataFileError('RECOVERY_REQUIRED', path);
          }
        }
        return { status: 'missing' };
      }
      const text = await this.files.read(path);
      try {
        return { status: 'ready', value: decode(JSON.parse(text)) };
      } catch {
        throw new DataFileError('INVALID_DATA', path);
      }
    } catch (error) {
      if (error instanceof DataFileError) throw error;
      throw new DataFileError('READ_FAILED', path);
    }
  }

  read<T>(path: string, decode: JsonDecoder<T>): Promise<JsonRead<T>> {
    return this.enqueue(path, () => this.readNow(path, decode));
  }

  write<T>(path: string, value: T, decode: JsonDecoder<T>): Promise<void> {
    // Capture and validate now: later mutation of the caller's object cannot alter this write.
    let text: string;
    try {
      text = JSON.stringify(decode(value), null, 2);
      if (typeof text !== 'string') throw new Error('Not JSON');
      decode(JSON.parse(text));
    } catch {
      return Promise.reject(new DataFileError('INVALID_DATA', path));
    }
    return this.enqueue(path, async () => {
      // A broken existing file must never be treated as a new profile or overwritten.
      const existing = await this.readNow(path, decode);
      const temporary = path + '.tmp';
      const backupTemporary = path + '.bak.tmp';
      try {
        await this.files.write(temporary, text);
        decode(JSON.parse(await this.files.read(temporary)));
        if (existing.status === 'ready') {
          await this.files.copy(path, backupTemporary);
          decode(JSON.parse(await this.files.read(backupTemporary)));
          await this.files.rename(backupTemporary, path + '.bak');
        }
        // Never delete the primary to make replacement succeed. Failure preserves it.
        await this.files.rename(temporary, path);
      } catch {
        // Keep recovery material when the primary is absent. Do not auto-restore it.
        try {
          if (await this.files.exists(path)) {
            if (await this.files.exists(temporary)) await this.files.remove(temporary);
            if (await this.files.exists(backupTemporary)) await this.files.remove(backupTemporary);
          }
        } catch { /* Cleanup failure must not hide the original save failure. */ }
        throw new DataFileError('WRITE_FAILED', path);
      }
    });
  }
}
