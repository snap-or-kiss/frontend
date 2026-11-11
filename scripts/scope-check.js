#!/usr/bin/env node
// 바뀐 파일이 PR의 Scope: 밖이면 경고한다. 의존성 없음.
// 사용: node scripts/scope-check.js --scope "index.html,docs/**,*.md" --base origin/main [--strict]
// 범위를 안 적으면 검사하지 않는다. --strict이면 범위 밖 파일이 있을 때 종료 코드 1.
const { execFileSync } = require('child_process');

function arg(name) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; }
const strict = process.argv.includes('--strict');
const base = arg('--base') || 'origin/main';
let scope = arg('--scope');
if (scope === undefined && process.env.PR_BODY) {
  const m = process.env.PR_BODY.match(/^\s*Scope:\s*(.+)$/mi);
  if (m) scope = m[1];
}
if (!scope || !scope.trim() || /^[\[(<]/.test(scope.trim())) { console.log('Scope가 없어서 검사하지 않는다.'); process.exit(0); }

// 범위 문법: dir/ 아래 전부 · * 슬래시 뺀 아무 글자 · ** 슬래시 포함 아무 글자 · **/ 폴더 몇 겹이든 · 그 밖은 정확히 같은 경로
function toRegex(p) {
  if (p.startsWith('/') || /(^|\/)\.\.(\/|$)/.test(p)) throw new Error('절대경로와 ..은 쓸 수 없다: ' + p);
  p = p.replace(/^\.\//, '');
  if (p.endsWith('/')) p += '**';
  let re = '';
  for (let i = 0; i < p.length; i++) {
    if (p.startsWith('**/', i)) { re += '(?:.*/)?'; i += 2; }
    else if (p.startsWith('**', i)) { re += '.*'; i += 1; }
    else if (p[i] === '*') re += '[^/]*';
    else re += p[i].replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

let patterns;
try { patterns = scope.split(',').map(s => s.trim()).filter(Boolean).map(toRegex); }
catch (e) { console.error(e.message); process.exit(2); }

function changed() {
  for (const range of [base + '...HEAD', base + '..HEAD']) {
    try { return execFileSync('git', ['diff', '--name-only', range], { encoding: 'utf8' }).split('\n').filter(Boolean); }
    catch (_) {}
  }
  console.error('바뀐 파일을 구하지 못했다. --base를 확인하세요: ' + base); process.exit(2);
}

const files = changed();
const outside = files.filter(f => !patterns.some(r => r.test(f)));
if (!outside.length) { console.log('범위 안: 바뀐 파일 ' + files.length + '개 모두 Scope 안에 있다.'); process.exit(0); }
for (const f of outside) {
  console.log((process.env.GITHUB_ACTIONS ? '::warning file=' + f + '::' : '경고: ') + 'Scope 밖의 파일이 바뀌었다: ' + f);
}
console.log('Scope 밖 ' + outside.length + '개. 의도한 변경이면 PR의 Scope:를 고치고, 아니면 되돌린다. (사람에게 물을 일)');
process.exit(strict ? 1 : 0);
