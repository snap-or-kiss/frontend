#!/usr/bin/env node
// index.html의 게임 로직을 가짜 DOM에서 돌려 점수 규칙을 검사한다. 의존성 없음.
// 사용: node scripts/sim.js [index.html 경로]
const fs = require('fs');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const src = html.split('<script>')[1].split('</script>')[0];

// 가짜 DOM: 어떤 속성을 읽어도 또 다른 가짜를 돌려준다
const mk = () => new Proxy(function () {}, {
  get: (t, k) => k === 'classList' ? { add() {}, remove() {}, toggle() {}, contains: () => false }
    : k === 'style' ? {} : k === 'dataset' ? {}
    : k === 'getBoundingClientRect' ? () => ({ left: 0, top: 0, width: 960, height: 540 })
    : k === 'measureText' ? () => ({ width: 100 })
    : k === 'createLinearGradient' ? () => ({ addColorStop() {} })
    : k === 'value' ? 'tester' : mk(),
  set: () => true, apply: () => mk(),
});
global.document = { querySelector: () => mk(), querySelectorAll: () => [], createElement: () => mk() };
global.window = { addEventListener() {}, devicePixelRatio: 1 };
const store = {};
global.localStorage = { getItem: k => store[k] ?? null, setItem(k, v) { store[k] = v; } };
global.requestAnimationFrame = () => {};

// 같은 결과가 나오도록 난수를 고정한다
let seed = 12345;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

(0, eval)(src + `
;globalThis.T={startGame,update,render,finish,showResult,
  setMode:m=>{selectedMode=m},
  get G(){return G},get state(){return state},get SAVE(){return SAVE},
  setMouse:(x,y)=>{mouse.x=x;mouse.y=y},hold:v=>{down=v},
  C:{L,MM,TOL,PERFECT,KISS}};`);
const T = global.T;

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('FAIL  ' + msg); } };
const near = (a, b) => Math.abs(a - b) <= 0.051;

// 상수
ok(Math.abs(T.C.L * T.C.MM - 180) < 1e-6, '빼빼로 길이는 180mm여야 한다');
ok(T.C.TOL === 9 && T.C.PERFECT === 2.5, '각도 허용치는 9°, 퍼펙트는 2.5°여야 한다(README FE-05)');

function play(policy) {
  T.startGame();
  let n = 0;
  while (T.state === 'play' && n++ < 20000) {
    const G = T.G; T.setMouse(G.A.x, G.A.y); policy(G); T.update(1 / 60); T.render();
  }
  return T.G;
}
const round1 = v => Math.round(v * 10) / 10;
const policies = {
  '가만히 있음': () => T.hold(false),
  '계속 먹음': () => T.hold(true),
  '조심해서 먹고 끊음': G => { T.hold(G.err < 6); if (G.R * T.C.MM < 18) T.finish('snap'); },
};
const counts = {};
for (const [name, policy] of Object.entries(policies)) {
  for (let i = 0; i < 12; i++) {
    const G = play(policy), kind = G.end.kind, eaten = G.sp * T.C.MM, left = G.R * T.C.MM;
    counts[kind] = (counts[kind] || 0) + 1;
    ok(['snap', 'aisnap', 'break', 'kiss'].includes(kind), name + ': 알 수 없는 종료 ' + kind);
    ok(G.score >= 0 && G.score <= 207, name + ': 점수가 범위 밖 ' + G.score);
    if (kind === 'aisnap' || kind === 'kiss') ok(G.score === 0, name + ': ' + kind + '은 0점이어야 한다(README A-2). 실제 ' + G.score);
    if (kind === 'break') ok(near(G.score, round1(eaten * 0.5)), name + ': 부러지면 먹은 길이의 절반이어야 한다');
    if (kind === 'snap') ok(near(G.score, round1(eaten * (left <= 20 ? 1.15 : 1))), name + ': 끊으면 먹은 길이(남은 20mm 이하면 ×1.15)여야 한다');
    ok(G.coins === Math.round(G.score), name + ': 코인은 점수 반올림이어야 한다');
    ok(G.stress >= 0 && G.stress <= 100, name + ': 균열 값이 0~100을 벗어났다');
  }
}
ok((counts.kiss || 0) > 0 && (counts.snap || 0) > 0, '뽀뽀와 끊기 결과가 모두 나와야 한다: ' + JSON.stringify(counts));

T.setMode('continuous');
// 두 판 성공 뒤 실패해도 확보 점수 보존. 중간 저장/중복 지급 방지.
T.startGame();
const before = T.SAVE.coins;
T.G.sp = 100 / T.C.MM; T.G.R = 20 / T.C.MM;
T.finish('snap');
ok(T.G.score === 115 && T.SAVE.coins === before, '20mm 경계 성공: 보너스 확보, 지급 보류');
T.showResult();
ok(T.state === 'play', '성공 뒤 다음 판으로 진행');
T.G.sp = 80 / T.C.MM; T.G.R = 19 / T.C.MM;
T.finish('snap'); T.showResult();
T.finish('aisnap');
ok(T.G.score === 207 && T.SAVE.coins === before + 207, '두 판 누적 보존 및 코인 한 번 지급');
T.finish('aisnap');
ok(T.SAVE.coins === before + 207, '종료 중복 호출 시 코인 중복 지급 방지');
T.startGame(); T.G.sp = 100 / T.C.MM; T.G.R = 20.01 / T.C.MM;
T.finish('snap'); ok(!T.G.end.advance, '20mm 초과면 연속 진행 안 함');

console.log('종료 분포: ' + JSON.stringify(counts));
console.log(failed ? failed + '개 실패' : '모두 통과');
process.exit(failed ? 1 : 0);
