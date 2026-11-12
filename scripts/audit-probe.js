// 브라우저에서 한 화면 크기를 측정한다. 창 크기를 바꾼 뒤 페이지를 새로고침하고 이 파일을 eval 한다.
//   eval(await (await fetch('/scripts/audit-probe.js')).text())
// 메뉴 → 상점 → 결과 → 플레이 네 화면을 차례로 띄우며 넘침·잘림·빈 공간을 JSON 한 줄로 돌려준다.
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const vw = innerWidth, vh = innerHeight, out = { vp: vw + 'x' + vh, touch: TOUCH, s: {} };
  const measure = name => {
    const stage = document.querySelector('#stage'), sr = stage.getBoundingClientRect();
    const ov = document.querySelector('#overlay'), shown = ov.classList.contains('show');
    const card = shown ? [...ov.querySelectorAll('.card')].find(c => c.offsetParent !== null) : null;
    const cr = card && card.getBoundingClientRect();
    const ovCs = getComputedStyle(ov), scrolls = shown && /auto|scroll/.test(ovCs.overflowY) && ov.scrollHeight > ov.clientHeight + 1;
    const issues = [];
    if (document.documentElement.scrollWidth > vw + 1) issues.push('pageScrollX');
    if (document.documentElement.scrollHeight > vh + 1) issues.push('pageScrollY');
    // 글자가 화면 밖으로 나간 요소 (스크롤되는 오버레이 안의 세로 밖은 제외)
    let off = 0; const offNames = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg') || el.tagName === 'CANVAS') continue;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      if (r.right > vw + 1 || r.left < -1) { off++; if (offNames.length < 3) offNames.push(el.tagName + '.' + (el.id || el.className) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); }
    }
    if (off) issues.push('textOffX:' + off + ' ' + offNames.join(' | '));
    // 카드가 그것을 담은 오버레이 밖으로 잘리는데 스크롤도 안 되면 문제
    const orr = ov.getBoundingClientRect();
    if (card && !scrolls && (cr.bottom > orr.bottom + 1 || cr.top < orr.top - 1)) issues.push('cardClipped:' + Math.round(cr.bottom - orr.bottom));
    const gw = 960 * VIEW.s, gh = 540 * VIEW.s;
    const info = { stage: Math.round(sr.width) + 'x' + Math.round(sr.height), fillX: +(sr.width / vw).toFixed(2), fillY: +(sr.height / vh).toFixed(2), game: Math.round(gw) + 'x' + Math.round(gh) };
    if (card) info.card = Math.round(cr.height) + (scrolls ? 'scroll' : '');
    if (name === 'play') {
      // 플레이 화면: 무대가 창을 얼마나 덮는지, 게임 영역이 너무 작지 않은지
      const area = (sr.width * sr.height) / (vw * vh);
      const immersive = matchMedia('(pointer:coarse),(max-height:620px)').matches || (document.documentElement.classList.contains('rot') && matchMedia('(orientation:portrait) and (max-width:900px)').matches);
      if (area < (immersive ? .97 : .75)) issues.push('stageSmall:' + area.toFixed(2));
      // 무대 밖으로 나간 가장자리 HUD가 없도록: 보이는 영역이 게임 세계를 충분히 덮는지
      if (VIEW.x0 > 1 || VIEW.y0 > 1) issues.push('viewCropsWorld');
      if (Math.min(gw, gh) < 280) issues.push('gameTiny:' + Math.round(gw) + 'x' + Math.round(gh));
    }
    out.s[name] = { ...info, issues };
  };
  try {
    toMenu(); await sleep(350); measure('menu');
    showShop(true); await sleep(350); measure('shop'); showShop(false); await sleep(150);
    startGame(); await sleep(250); G.sp = 40 / MM; G.R = (STICK_MM - 40) / MM; finish('snap'); await sleep(1500); measure('result');
    toMenu(); await sleep(250); startGame(); await sleep(900); measure('play');
  } catch (e) { out.err = String(e) }
  return JSON.stringify(out);
})()
