/**
 * Days Since - task storage.
 *
 * Every task is a JSON file in the data directory. Shape and behavior mirror
 * the original Flask app (get_all_tasks/get_task_by_id in app.py), including
 * Python's lenient strptime('%Y-%m-%d') date parsing (2026-1-31 is valid).
 */
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// %Y = exactly 4 digits, %m/%d = 1-2 digits (like Python's strptime)
const DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const DAY_MS = 86_400_000;

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Local date as zero-padded YYYY-MM-DD (Python: date.today().strftime('%Y-%m-%d')). */
export function todayStr() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Mirrors datetime.strptime(s, '%Y-%m-%d') succeeding: real calendar date, year 1-9999. */
export function isValidDateStr(value) {
  const match = DATE_PATTERN.exec(typeof value === 'string' ? value : '');
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= daysInMonth;
}

/** Whole days between a stored date and today's local date (Python: (date.today() - d).days). */
export function daysSinceDate(value) {
  if (!isValidDateStr(value)) {
    throw new Error(`time data '${value}' does not match format '%Y-%m-%d'`);
  }
  const match = DATE_PATTERN.exec(value);
  const then = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - then) / DAY_MS);
}

/** Creates a task store rooted at `dataDir` (cwd-relative when relative, like the original). */
export function createTaskStore(dataDir) {
  const taskFilepath = (id) => join(dataDir, `${id}.json`);

  async function ensureDataDir() {
    await mkdir(dataDir, { recursive: true });
  }

  async function exists(filepath) {
    try {
      await stat(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /** Parses a task file; rejects anything but a JSON object, like Python's task['key'] access does. */
  async function readJson(filepath) {
    const data = JSON.parse(await readFile(filepath, 'utf8'));
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new TypeError(`Task file ${filepath} does not contain a JSON object`);
    }
    return data;
  }

  async function write(filepath, task) {
    await ensureDataDir();
    await writeFile(filepath, JSON.stringify(task, null, 2));
  }

  async function remove(filepath) {
    await unlink(filepath);
  }

  const byName = (a, b) => {
    const an = String(a.name ?? '').toLowerCase();
    const bn = String(b.name ?? '').toLowerCase();
    return an < bn ? -1 : an > bn ? 1 : 0;
  };

  /** All tasks with filename/daysSince/daysUntilDue added, sorted by name (get_all_tasks). */
  async function list() {
    await ensureDataDir();
    const filenames = (await readdir(dataDir)).filter((f) => f.endsWith('.json'));
    const tasks = [];
    for (const filename of filenames) {
      try {
        const data = await readJson(join(dataDir, filename));
        const task = { ...data, filename };

        const lastReset = data.lastReset;
        let days = 0;
        if (lastReset) {
          days = daysSinceDate(lastReset); // invalid date -> file skipped, like strptime
        }
        task.daysSince = days;

        const cycle = data.cycle;
        if (lastReset && cycle) {
          task.daysUntilDue = cycle - days;
        }

        tasks.push(task);
      } catch (e) {
        console.error(`Error reading ${filename}: ${e.message}`);
      }
    }
    tasks.sort(byName);
    return tasks;
  }

  /** Single task by id with filename added, or null if missing/unreadable (get_task_by_id). */
  async function read(id) {
    const filepath = taskFilepath(id);
    try {
      if (await exists(filepath)) {
        const task = await readJson(filepath);
        task.filename = `${id}.json`;
        return task;
      }
    } catch (e) {
      console.error(`Error reading task ${id}: ${e.message}`);
    }
    return null;
  }

  return { taskFilepath, exists, readJson, write, remove, list, read };
}
