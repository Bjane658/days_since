/**
 * Days Since - page rendering.
 *
 * Renders templates/index.html with the task grid injected in place of the
 * <!-- TASKS --> marker. Mirrors the Jinja2 template of the original app
 * (tile color thresholds, due labels, cycle badge, empty state).
 */
import { join } from 'node:path';

const TEMPLATE_PATH = join(import.meta.dir, 'templates', 'index.html');
const TASKS_MARKER = '<!-- TASKS -->';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" };

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Tile color class - same thresholds as the original Jinja template. */
function tileClass(task) {
  const { daysSince: days, cycle } = task;
  if (cycle) {
    if (days < cycle) return 'fresh';
    if (days <= cycle + 1) return 'warning';
    return 'overdue';
  }
  if (days <= 2) return 'fresh';
  if (days <= 7) return 'warning';
  return 'overdue';
}

function cycleBadge(task) {
  if (!task.cycle) return '';
  const cycle = escapeHtml(task.cycle);
  return `<span class="badge badge-ghost" title="Every ${cycle} days">${cycle}d</span>`;
}

function dueLabel(task) {
  if (!task.cycle) return '';
  const due = task.cycle - task.daysSince;
  if (due > 1) return `<div class="due-label text-sm opacity-60">due in ${due} days</div>`;
  if (due === 1) return '<div class="due-label text-sm opacity-60">due tomorrow</div>';
  if (due === 0) return '<div class="due-label due-today text-sm font-bold text-error">due today</div>';
  return `<div class="due-label due-today text-sm font-bold text-error">${-due} day${due === -1 ? '' : 's'} overdue</div>`;
}

function tileHtml(task) {
  const id = escapeHtml(task.id ?? '');
  const name = escapeHtml(task.name ?? '');
  const days = task.daysSince;
  return [
    `            <div class="task-tile card card-border bg-base-100 cursor-pointer shadow-sm transition-shadow duration-300 hover:shadow-md ${tileClass(task)}" data-task-id="${id}">`,
    `                <div class="card-body gap-2">`,
    `                    <div class="card-title text-lg"><span class="task-name">${name}</span> ${cycleBadge(task)}</div>`,
    `                    <div class="days-since text-5xl font-bold">${days}</div>`,
    `                    <div class="days-label opacity-60">day${days === 1 ? '' : 's'} ago</div>`,
    `                    ${dueLabel(task)}`,
    `                    <div class="card-actions mt-3">`,
    `                        <button class="btn btn-success btn-soft flex-1" onclick="resetTask('${id}', event)">Done Today!</button>`,
    `                        <button class="btn btn-error btn-soft px-3" onclick="deleteTask('${id}', event)" aria-label="Delete task">×</button>`,
    `                    </div>`,
    `                </div>`,
    `            </div>`,
  ].join('\n');
}

const EMPTY_GRID = [
  '            <div class="empty-state text-center opacity-60 col-span-full py-20">',
  '                <h2 class="text-3xl font-bold text-base-content">No tasks yet!</h2>',
  '                <p class="text-xl">Add your first task above to start tracking.</p>',
  '            </div>',
].join('\n');

/** Renders the full index page for the given task list (sorted by name). */
export async function renderIndex(tasks) {
  const template = await Bun.file(TEMPLATE_PATH).text();
  const grid = tasks.length ? tasks.map(tileHtml).join('\n') : EMPTY_GRID;
  // Function form: a task name containing '$' must not act as a replacement pattern.
  return template.replace(TASKS_MARKER, () => grid);
}
