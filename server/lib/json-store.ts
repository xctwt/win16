import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";

const stores = new Set<JsonStore<unknown>>();

/**
 * A JSON file kept in memory. Writes are debounced, serialized and atomic
 * (write to a temp file, then rename), so concurrent requests can't corrupt it.
 */
export class JsonStore<T> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private queue: Promise<void> = Promise.resolve();
  private dirty = false;

  private constructor(
    private readonly path: string,
    public data: T,
    private readonly delayMs: number,
  ) {}

  /** `load` receives whatever is on disk (or undefined) and must return valid data. */
  static async open<T>(path: string, load: (raw: unknown) => T, delayMs = 500): Promise<JsonStore<T>> {
    await mkdir(dirname(path), { recursive: true });
    let raw: unknown;
    try {
      raw = await Bun.file(path).json();
    } catch {
      raw = undefined;
    }
    const store = new JsonStore(path, load(raw), delayMs);
    stores.add(store as JsonStore<unknown>);
    return store;
  }

  /** Schedule a write; bursts of changes collapse into a single write. */
  save(): void {
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delayMs);
  }

  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (!this.dirty) return this.queue;
    this.dirty = false;
    const json = JSON.stringify(this.data, null, 2);
    this.queue = this.queue
      .then(async () => {
        const tmp = `${this.path}.tmp`;
        await Bun.write(tmp, json);
        await rename(tmp, this.path);
      })
      .catch((err) => console.error(`Failed to write ${this.path}:`, err));
    return this.queue;
  }
}

/** Flush every pending write, e.g. on shutdown. */
export function flushAllStores(): Promise<void[]> {
  return Promise.all([...stores].map((s) => s.flush()));
}
