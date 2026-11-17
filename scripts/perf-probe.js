// 브라우저에서 그리기 비용을 잰다. 창 크기를 정하고 새로고침한 뒤:
//   eval(await (await fetch('/scripts/perf-probe.js')).text())
// render()를 N번 연달아 호출해 한 프레임 평균(ms)과 단계별 비용을 JSON 한 줄로 돌려준다.
// 캔버스는 명령을 쌓아 두었다가 나중에 그리기도 해서, 끝에 getImageData로 한 번 비워 실제 비용을 포함한다.
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  startGame(); await sleep(600);
  const parts = ['drawBG', 'drawScene', 'drawHUD', 'realStick', 'inkStick', 'inkPlayer', 'inkAI', 'layerPlayer', 'layerAI', 'drawGauge'];
  const acc = {}, orig = {};
  for (const n of parts) {
    orig[n] = window[n]; acc[n] = 0;
    window[n] = function (...a) { const t = performance.now(); const r = orig[n].apply(this, a); acc[n] += performance.now() - t; return r; };
  }
  const N = 300;
  const flush = () => ctx.getImageData(0, 0, 1, 1);
  for (let i = 0; i < 20; i++) render();          // 예열
  flush(); for (const n of parts) acc[n] = 0;
  // 1) 명령을 만드는 데 드는 CPU 시간(렌더링은 나중으로 미뤄질 수 있다)
  const c0 = performance.now();
  for (let i = 0; i < N; i++) render();
  const cpu = (performance.now() - c0) / N;
  flush();
  // 2) 매 프레임 비우며 재서 실제 그리기까지 포함한 비용
  const t0 = performance.now();
  for (let i = 0; i < N; i++) { render(); flush(); }
  const total = (performance.now() - t0) / N;
  for (const n of parts) window[n] = orig[n];
  const cv = document.querySelector('canvas');
  const out = {
    vp: innerWidth + 'x' + innerHeight, dpr: devicePixelRatio, buf: cv.width + 'x' + cv.height, mp: +(cv.width * cv.height / 1e6).toFixed(2),
    cpuMs: +cpu.toFixed(2), frameMs: +total.toFixed(2),
    parts: Object.fromEntries(parts.map(n => [n, +(acc[n] / N).toFixed(2)])),
  };
  return JSON.stringify(out);
})()
