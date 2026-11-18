import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from '../client/node_modules/@babel/parser/lib/index.js';

const ROOT = path.join(process.cwd(), 'client', 'src');
const USER_ATTRIBUTES = new Set(['alt', 'aria-label', 'helper', 'label', 'placeholder', 'title']);
const issues = [];

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(target);
    return /\.(?:js|jsx)$/.test(entry.name) ? [target] : [];
  });
}

function visibleLiteral(node) {
  if (!node) return '';
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'TemplateLiteral') return node.quasis.map((item) => item.value.cooked || '').join('');
  if (node.type === 'ConditionalExpression') return `${visibleLiteral(node.consequent)} ${visibleLiteral(node.alternate)}`;
  if (node.type === 'LogicalExpression') return visibleLiteral(node.right);
  return '';
}

function visit(node, source, file, parent = null) {
  if (!node || typeof node !== 'object') return;
  const line = node.loc?.start?.line || 1;

  if (node.type === 'JSXText' && /[A-Za-z]/.test(node.value)) {
    issues.push(`${file}:${line} hardcoded JSX text: ${node.value.trim()}`);
  }

  if (node.type === 'JSXAttribute' && USER_ATTRIBUTES.has(node.name?.name) && node.value?.type === 'StringLiteral' && /[A-Za-z]/.test(node.value.value)) {
    issues.push(`${file}:${line} hardcoded ${node.name.name}: ${node.value.value}`);
  }

  if (node.type === 'JSXExpressionContainer' && parent?.type !== 'JSXAttribute') {
    const text = visibleLiteral(node.expression);
    if (/[A-Za-z]/.test(text)) issues.push(`${file}:${line} hardcoded JSX expression: ${text.trim()}`);
  }

  if (node.type === 'CallExpression') {
    const name = node.callee?.name || node.callee?.property?.name;
    if (name === 'alert' || name === 'confirm') issues.push(`${file}:${line} native ${name}() call`);
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => visit(child, source, file, node));
    else if (value && typeof value === 'object' && value.type) visit(value, source, file, node);
  }
}

for (const absolute of filesIn(ROOT)) {
  const relative = path.relative(process.cwd(), absolute).replaceAll('\\', '/');
  if (relative.endsWith('/lib/messages.js') || /\.test\.[jt]sx?$/.test(relative)) continue;
  const source = readFileSync(absolute, 'utf8');
  if (/\uFFFD|â(?:€|€™|€œ|€)|Ã[\x80-\xBF]/u.test(source)) issues.push(`${relative}: possible mojibake`);
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  visit(ast, source, relative);
}

if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else {
  console.log('[copy-audit] OK - visible literals are centralized and source text is valid UTF-8.');
}
