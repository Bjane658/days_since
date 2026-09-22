#!/usr/bin/env bun
/**
 * Days Since - Track days since household tasks were completed.
 *
 * Bun port of the original Flask app: same endpoints, JSON-file storage,
 * CLI options and rendered page. No dependencies.
 *
 * Routes:
 *   GET    /                      index page
 *   GET    /static/*              static assets (css, fonts)
 *   GET    /api/tasks             list all tasks
 *   POST   /api/tasks             create a task
 *   GET    /api/tasks/:id         get one task
 *   PATCH  /api/tasks/:id         update lastReset / cycle
 *   DELETE /api/tasks/:id         delete a task
 *   POST   /api/tasks/:id/reset   mark a task as done today
 */
import { parseArgs } from 'node:util';
import { extname, resolve } from 'node:path';

import { createTaskStore, isValidDateStr, todayStr } from './store.js';
import { renderIndex } from './render.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 5000;
const DEFAULT_DATA_DIR = './data';

const STATIC_ROOT = resolve(import.meta.dir, 'static');

const HELP = `usage: bun app.js [-h] [--dir DIR] [--host HOST] [--port PORT]

Days Since - Track household tasks

options:
  -h, --help            show this help message and exit
  --dir DIR             Directory to save task files (default: ./data)
  --host HOST           Host to run the server on (default: 127.0.0.1)
  --port PORT           Port to run the server on (default: 5000)`;

// Generated ids only ever contain unicode letters/digits/underscore (see
// createTask below), so anything else can never name a stored task file and
// is rejected before touching the filesystem (blocks path traversal).
const SAFE_ID = /^[\p{L}\p{N}_]*$/u;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function parseCliArgs() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        help: { type: 'boolean', short: 'h' },
        dir: { type: 'string' },
        host: { type: 'string', default: DEFAULT_HOST },
        port: { type: 'string', default: String(DEFAULT_PORT) },
      },
    }));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (!/^\d+$/.test(values.port)) {
    console.error(`bun app.js: error: argument --port: invalid int value: '${values.port}'`);
    process.exit(2);
  }
  return { ...values, port: Number(values.port) };
}

const jsonResponse = (data, status = 200) => Response.json(data, { status });
const errorResponse = (status, message) => Response.json({ error: message }, { status });
const errorMessage = (e) => String(e?.message ?? e);
const notFound = () =>
  new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
const methodNotAllowed = (allow) => new Response(null, { status: 405, headers: { Allow: allow } });
const htmlResponse = (html) =>
  new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

/**
 * Builds the request handler around a task store. Returned object is a
 * valid Bun.serve argument ({ fetch }) and testable in-process.
 */
export function createApp(store) {
  async function serveStatic(segments) {
    const filepath = resolve(STATIC_ROOT, segments.join('/'));
    if (filepath !== STATIC_ROOT && !filepath.startsWith(STATIC_ROOT + '/')) {
      return notFound();
    }
    const file = Bun.file(filepath);
    if (!(await file.exists()) || (await file.stat()).isDirectory()) {
      return notFound();
    }
    const type = MIME_TYPES[extname(filepath).toLowerCase()] ?? 'application/octet-stream';
    return new Response(file, { headers: { 'Content-Type': type } });
  }

  async function createTask(req) {
    try {
      const data = await req.json();
      const name = data?.name;
      const cycle = data?.cycle;

      if (typeof name !== 'string' || !name) {
        return errorResponse(400, 'Name is required');
      }
      if (cycle !== undefined && cycle !== null) {
        if (!Number.isInteger(cycle) || cycle < 1) {
          return errorResponse(400, 'Cycle must be a whole number of days (>= 1)');
        }
      }

      // Same id scheme as the original: lowercase, spaces -> '_',
      // keep unicode letters/digits/underscore (umlauts stay).
      const id = [...name.toLowerCase().replaceAll(' ', '_')]
        .filter((ch) => /[\p{L}\p{N}_]/u.test(ch))
        .join('');

      const filepath = store.taskFilepath(id);
      if (await store.exists(filepath)) {
        return errorResponse(400, 'Task already exists');
      }

      const today = todayStr();
      const task = { id, name, lastReset: today, history: [today] };
      if (cycle !== undefined && cycle !== null) {
        task.cycle = cycle;
      }

      await store.write(filepath, task);
      return jsonResponse(task, 201);
    } catch (e) {
      console.error(e);
      return errorResponse(500, errorMessage(e));
    }
  }

  async function getTask(id) {
    try {
      if (!SAFE_ID.test(id)) return errorResponse(404, 'Task not found');
      const task = await store.read(id);
      if (!task) return errorResponse(404, 'Task not found');
      return jsonResponse(task, 200);
    } catch (e) {
      console.error(e);
      return errorResponse(500, errorMessage(e));
    }
  }

  async function resetTask(id) {
    try {
      const filepath = store.taskFilepath(id);
      if (!SAFE_ID.test(id) || !(await store.exists(filepath))) {
        return errorResponse(404, 'Task not found');
      }

      const task = await store.readJson(filepath);
      const today = todayStr();
      task.lastReset = today;
      task.history.push(today); // missing/broken history fails like the original

      await store.write(filepath, task);
      return jsonResponse(task, 200);
    } catch (e) {
      console.error(e);
      return errorResponse(500, errorMessage(e));
    }
  }

  async function updateTask(req, id) {
    try {
      const filepath = store.taskFilepath(id);
      if (!SAFE_ID.test(id) || !(await store.exists(filepath))) {
        return errorResponse(404, 'Task not found');
      }
      const task = await store.readJson(filepath);

      const data = await req.json();
      const newDate = data?.lastReset;
      const hasCycle = typeof data === 'object' && data !== null && 'cycle' in data;
      const newCycle = hasCycle ? data.cycle : null;

      if (!newDate) {
        return errorResponse(400, 'lastReset date is required');
      }
      if (!isValidDateStr(newDate)) {
        return errorResponse(400, 'Invalid date format. Use YYYY-MM-DD');
      }

      // Update cycle if provided (null removes it), like the original.
      if (hasCycle) {
        if (newCycle === null) {
          delete task.cycle;
        } else if (Number.isInteger(newCycle) && newCycle >= 1) {
          task.cycle = newCycle;
        } else {
          return errorResponse(400, 'Cycle must be a whole number of days (>= 1)');
        }
      }

      task.lastReset = newDate;
      // Like the original: missing history key -> .push fails -> 500.
      if (!(task.history ?? []).includes(newDate)) {
        task.history.push(newDate);
      }

      await store.write(filepath, task);
      return jsonResponse(task, 200);
    } catch (e) {
      console.error(e);
      return errorResponse(500, errorMessage(e));
    }
  }

  async function deleteTask(id) {
    try {
      const filepath = store.taskFilepath(id);
      if (!SAFE_ID.test(id) || !(await store.exists(filepath))) {
        return errorResponse(404, 'Task not found');
      }
      await store.remove(filepath);
      return jsonResponse({ success: true }, 200);
    } catch (e) {
      console.error(e);
      return errorResponse(500, errorMessage(e));
    }
  }

  async function indexPage() {
    const html = await renderIndex(await store.list());
    return htmlResponse(html);
  }

  return {
    async fetch(req) {
      let segments;
      try {
        segments = new URL(req.url).pathname.split('/').map(decodeURIComponent);
      } catch {
        return notFound();
      }
      const method = req.method;
      const [root, seg1, seg2, seg3, seg4] = segments; // root is '' (paths start with '/')

      try {
        if (segments.length === 2 && root === '' && seg1 === '') {
          if (method === 'GET' || method === 'HEAD') return indexPage();
          return methodNotAllowed('GET, HEAD, OPTIONS');
        }
        if (seg1 === 'static') {
          if (method === 'GET' || method === 'HEAD') return serveStatic(segments.slice(2));
          return methodNotAllowed('GET, HEAD, OPTIONS');
        }
        if (seg1 === 'api' && seg2 === 'tasks') {
          if (segments.length === 3) {
            if (method === 'GET') return jsonResponse(await store.list());
            if (method === 'POST') return createTask(req);
            return methodNotAllowed('GET, POST, OPTIONS');
          }
          if (segments.length === 4) {
            const id = seg3;
            if (method === 'GET') return getTask(id);
            if (method === 'PATCH') return updateTask(req, id);
            if (method === 'DELETE') return deleteTask(id);
            return methodNotAllowed('GET, PATCH, DELETE, OPTIONS');
          }
          if (segments.length === 5 && seg4 === 'reset') {
            if (method === 'POST') return resetTask(seg3);
            return methodNotAllowed('POST, OPTIONS');
          }
        }
        return notFound();
      } catch (e) {
        console.error(e);
        return errorResponse(500, errorMessage(e));
      }
    },
  };
}

export function main() {
  const args = parseCliArgs();
  const store = createTaskStore(args.dir ?? DEFAULT_DATA_DIR);

  if (args.dir) {
    console.log(`Tasks will be saved to: ${args.dir}`);
  }
  console.log(`Starting Days Since on http://${args.host}:${args.port}`);

  const app = createApp(store);
  Bun.serve({ hostname: args.host, port: args.port, fetch: app.fetch });
}

if (import.meta.main) {
  main();
}
