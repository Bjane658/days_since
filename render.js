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
  return `<span class="cycle-badge" title="Every ${cycle} days">${cycle}d</span>`;
}

function dueLabel(task) {
  if (!task.cycle) return '';
  const due = task.cycle - task.daysSince;
  if (due > 1) return `<div class="due-label">due in ${due} days</div>`;
  if (due === 1) return '<div class="due-label">due tomorrow</div>';
  if (due === 0) return '<div class="due-label due-today">due today</div>';
  return `<div class="due-label due-today">${-due} day${due === -1 ? '' : 's'} overdue</div>`;
}

function tileHtml(task) {
  const id = escapeHtml(task.id ?? '');
  const name = escapeHtml(task.name ?? '');
  const days = task.daysSince;
  return [
    `            <div class="task-tile ${tileClass(task)}" data-task-id="${id}">`,
    `                <div class="task-name">${name} ${cycleBadge(task)} </div>`,
    `                <div class="days-since">${days}</div>`,
    `                <div class="days-label">day${days === 1 ? '' : 's'} ago</div>`,
    `                ${dueLabel(task)}`,
    '                <div class="task-actions">',
    `                    <button class="btn btn-reset" onclick="resetTask('${id}', event)">Done Today!</button>`,
    `                    <button class="btn btn-delete" onclick="deleteTask('${id}', event)">×</button>`,
    '                </div>',
    '            </div>',
  ].join('\n');
}

const EMPTY_GRID = [
  '            <div class="empty-state">',
  '                <h2>No tasks yet!</h2>',
  '                <p>Add your first task above to start tracking.</p>',
  '            </div>',
].join('\n');

/** Renders the full index page for the given task list (sorted by name). */
export async function renderIndex(tasks) {
  const template = await Bun.file(TEMPLATE_PATH).text();
  const grid = tasks.length ? tasks.map(tileHtml).join('\n') : EMPTY_GRID;
  // Function form: a task name containing '$' must not act as a replacement pattern.
  return template.replace(TASKS_MARKER, () => grid);
}
