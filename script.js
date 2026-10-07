/* =========================================================
   CLOSE_DOOR · SEED #03 · SUDO SEED
   엘리베이터 닫힘 버튼 연타 게임 (그리고 당신의 양심 테스트)
   외부 라이브러리 없음. 효과음은 Web Audio, 판정서 이미지는 Canvas로 직접 그린다.
   ========================================================= */
(() => {
  'use strict';

  const SEED = 'SEED #03';
  const SITE_URL = 'https://sudoseed.github.io/seed-03-close-door/';

  const RULES = {
    topFloor: 10,       // 1층 출발, 10층 도착 → 1~9층에서 9번 정차
    closeMin: 6,        // 닫힘 1회에 닫히는 양(%)
    closeMax: 9,
    reopenPerSec: 5,    // 아무것도 안 누르면 다시 열리는 속도(%/초)
    travelSec: 0.8,     // 층 이동 연출
    runnerChance: 0.4,  // 층마다 달려오는 사람 확률
    runnerMin: 3,       // 최소 등장 횟수 보정
    arriveSec: 2.5,     // 달려오는 사람 도착까지
    openPenalty: 1.5,   // 열어 주면 시간 페널티(초)
    placeboSec: 3,      // 닫힘 버튼이 '작동하지 않는' 시간
  };

  // 판정 기준(초). 9번 정차 + 이동 연출 7.2초를 포함한 총 소요 시간
  const TIME = { fast: 32, slow: 50, mid: 40, sd: 10 };

  /* ---------------------------------------------------------
     달려오는 사람 12종
     kind: normal(태우면 탑승) | fake(옆 엘리베이터) | gym(계단) | overload(정원 초과)
     board/ignore: 열어 줬을 때 / 문을 닫아 버렸을 때 양심 점수
     awk: 탑승 시 어색함 변화(MAX = 100)
     --------------------------------------------------------- */
  const PEOPLE = [
    { id: 'courier', kind: 'normal', name: '택배 기사님', head: '🧔', item: '📦<br>📦<br>📦<br>📦<br>📦', stack: true,
      torso: '#7d7d7d', legs: '#3d3d3d',
      line: '잠깐만요!! 7층이요!!', thanks: '감사합니다~ (상자 5개)', gap: '…아. (상자 5개)',
      board: 15, ignore: -15, awk: 10 },
    { id: 'grandma', kind: 'normal', name: '장바구니 든 할머니', head: '👵', item: '🛒',
      torso: '#b5b5b5', legs: '#6a6a6a',
      line: '아이고 젊은이~', thanks: '아이고 고마워라~', gap: '…아이고.',
      board: 20, ignore: -30, awk: 5 },
    { id: 'newbie', kind: 'normal', name: '커피 4잔 든 신입사원', head: '😅', item: '☕☕<br>☕☕', stack: true,
      torso: '#d9d9d9', legs: '#2b2b2b', mark: '#2b2b2b', markW: '.5em',
      line: '팀장님 커피예요!!', thanks: '감사합니다!! (커피 출렁)', gap: '…아. 커피가…',
      board: 10, ignore: -10, awk: 12 },
    { id: 'leader', kind: 'normal', name: '팀장님', head: '😏', item: '💼', leader: true,
      torso: '#2a2a2a', legs: '#1a1a1a', mark: 'var(--red)', markW: '.55em',
      line: '어이~', thanks: '어, 고마워. 몇 층 가나?', gap: '…어이?',
      board: 10, ignore: -10, awk: 40 },
    { id: 'dog', kind: 'normal', name: '강아지 산책하는 이웃', head: '🙂', item: '🐕',
      torso: '#9a9a9a', legs: '#4f4f4f',
      line: '멍!', thanks: '멍멍! (꼬리 붕붕)', gap: '…끼잉.',
      board: 10, ignore: -10, awk: -20 },
    { id: 'neighbor', kind: 'normal', name: '같은 층 사는 어색한 이웃', head: '😐', item: '',
      torso: '#5e5e5e', legs: '#333',
      line: '…… (눈만 마주침)', thanks: '…… (꾸벅)', gap: '…(목례)',
      board: 5, ignore: -5, awk: 'max' },
    { id: 'rider', kind: 'normal', name: '배달 라이더', head: '😤', item: '🍗',
      torso: '#444', legs: '#222', mark: '#e6e6e6', markW: '1.6em',
      line: '치킨 식어요!!', thanks: '감사합니다!! 맛있게 드세요!!', gap: '…아. 치킨 식는다.',
      board: 10, ignore: -10, awk: 8 },
    { id: 'fake', kind: 'fake', name: '달려오는 남자', head: '😃', item: '',
      torso: '#8a8a8a', legs: '#3a3a3a',
      lines: ['잠깐만요!', '잠깐만요!! (진짜로)', '이번엔 진짜 탈게요!!'],
      reveals: ['아 저 옆에 거 탈게요~', '아 저 또 옆에 거요~', '…옆에 거요 ㅎ'],
      gap: '(옆 엘리베이터: 띵-)',
      board: 0, ignore: 0, awk: 0 },
    { id: 'gym', kind: 'gym', name: '헬스장 가는 사람', head: '😁', item: '💪',
      torso: '#c8c8c8', legs: '#111',
      line: '헉… 헉… 잠깐—', reveal: '계단 탈게요 ㅎ',
      board: 0, ignore: 0, awk: 0 },
    { id: 'overload', kind: 'overload', name: '꽉 찬 엘리베이터에 타려는 사람', head: '😬', item: '🧳',
      torso: '#6e6e6e', legs: '#2f2f2f',
      line: '숨 참으면 탈 수 있어요!!', thanks: '감사합니다! (끼익)', exit: '…다음 거 탈게요.', gap: '…아. 다음 거 탈게요.',
      board: 5, ignore: -5, awk: 0 },
    { id: 'student', kind: 'normal', name: '지각한 학생', head: '😫', item: '🎒',
      torso: '#3c3c3c', legs: '#777',
      line: '저 1교시예요!!!', thanks: '감사합니다!!! (헉헉)', gap: '…아. 지각 확정.',
      board: 10, ignore: -10, awk: 10 },
    { id: 'flowers', kind: 'normal', name: '꽃다발 든 사람', head: '😊', item: '💐',
      torso: '#1f1f1f', legs: '#111', mark: '#f2f2f2', markW: '.45em',
      line: '오늘 프러포즈해요!!', thanks: '감사합니다!! 행운을 빌어 주세요!', gap: '…아. 꽃잎 떨어졌다.',
      board: 15, ignore: -20, awk: 15 },
  ];

  /* ---------------------------------------------------------
     칭호(위에서부터 먼저 맞는 것 하나) + 진지한 척하는 총평 2개
     --------------------------------------------------------- */
  const TITLES = [
    { id: 'fake', test: (v) => v.fooled >= 2,
      name: (v) => `페이크남에게 ${v.fooled}번 속은 사람`,
      lines: [
        '피검자는 같은 사람에게 {fooled}번 속았습니다. 위원회는 피검자의 신뢰가 무한 리필된다는 사실을 확인하였습니다.',
        '‘잠깐만요’를 듣고 문을 연 횟수와 실제로 탄 사람 수가 일치하지 않습니다. 그래도 피검자는 다음에 또 열 것입니다.',
      ] },
    { id: 'boss', test: (v) => v.leaderOpened && v.realOpened === 1 && v.ignored >= 1,
      name: () => '팀장님만 열어주는 사람',
      lines: [
        '피검자의 양심은 직급에 따라 선택적으로 작동합니다. 위원회는 이를 ‘사회생활’이라는 이름으로 기록합니다.',
        '피검자는 팀장님 앞에서만 열림 버튼의 존재를 기억해 냈습니다. 놀라운 기억력입니다.',
      ] },
    { id: 'grandma', test: (v) => v.grandmaIgnored && v.cons <= 0,
      name: () => '장바구니 할머니를 두고 간 사람',
      lines: [
        '피검자는 ‘아이고 젊은이~’를 듣고도 닫힘 버튼을 눌렀습니다. 할머니의 장바구니에는 대파가 들어 있었습니다.',
        '위원회는 피검자의 다음 명절 덕담 자격을 잠정 보류합니다.',
      ] },
    { id: 'selfish', test: (v) => v.q <= -0.6 && v.z >= 0.5,
      name: (v) => `상위 ${v.selfPct}%의 이기적인 사람`,
      lines: [
        '피검자의 닫힘 버튼에는 망설임이 없었습니다. 문틈 너머의 ‘…아.’도 피검자를 멈추지 못했습니다.',
        '위원회는 피검자가 ‘잠깐만요’를 ‘빨리 닫으세요’로 알아듣는 독특한 청각 구조를 지녔다고 판단합니다.',
      ] },
    { id: 'slowSelfish', test: (v) => v.q <= -0.6,
      name: () => '느긋하게 이기적인 사람',
      lines: [
        '피검자는 아무도 태우지 않았는데도 오래 걸렸습니다. 위원회는 이 미스터리를 아직 풀지 못했습니다.',
        '이기적이려면 빠르기라도 해야 한다는 것이 위원회의 오랜 입장입니다.',
      ] },
    { id: 'saint', test: (v) => v.q >= 0.8 && v.time < TIME.slow,
      name: () => '엘리베이터 성자',
      lines: [
        '위원회는 피검자가 닫힘 버튼보다 열림 버튼을 먼저 찾는 희귀한 반사신경을 지녔음을 확인하였습니다.',
        '피검자가 탑승한 엘리베이터에서는 아무도 ‘…아.’라고 말하지 않았습니다. 통계적으로 매우 이례적인 일입니다.',
      ] },
    { id: 'late', test: (v) => v.q >= 0.4 && v.time >= TIME.slow,
      name: () => '착한데 지각함',
      lines: [
        '피검자의 양심은 정시에 도착했으나 본인은 그러지 못했습니다.',
        '모두를 태워 준 대가로 피검자는 {time}초를 잃었습니다. 위원회는 이를 숭고한 손실로 분류합니다.',
      ] },
    { id: 'hands', test: (v) => v.handIns >= 2,
      name: () => '문틈 손 수집가',
      lines: [
        '피검자가 망설이는 동안 {handIns}개의 손이 문틈으로 들어왔습니다. 결정을 미루면 손이 대신 결정합니다.',
        '피검자는 열지도 닫지도 않았습니다. 문은 결국 남의 손으로 열렸습니다.',
      ] },
    { id: 'kind', test: (v) => v.q >= 0.4,
      name: () => '열림 버튼을 아는 사람',
      lines: [
        '피검자는 열림 버튼의 위치를 정확히 알고, 필요할 때 누를 줄 압니다. 이는 생각보다 드문 능력입니다.',
        '위원회는 피검자를 ‘같은 엘리베이터에 타도 괜찮은 사람’ 명단에 잠정 등재합니다.',
      ] },
    { id: 'master', test: (v) => v.maxCps >= 11,
      name: () => '닫힘 버튼 장인',
      lines: [
        '피검자의 검지는 초당 {cps}회의 속도로 엘리베이터 문과 대화했습니다. 문은 대답하지 않았습니다.',
        '측정 장비가 피검자의 연타 속도를 따라가지 못해 위원회는 회의를 잠시 중단했습니다.',
      ] },
    { id: 'efficient', test: (v) => v.time < TIME.fast,
      name: () => '효율의 화신',
      lines: [
        '피검자에게 엘리베이터는 사교 공간이 아니라 수직 이동 장치일 뿐입니다. 위원회는 이 관점을 부정하지 않습니다.',
        '피검자는 목적지에 가장 빨리 도착했습니다. 누구와 함께였는지는 기록되지 않았습니다.',
      ] },
    { id: 'lost', test: () => true,
      name: () => '양심과 시간 사이에서 길을 잃은 자',
      lines: [
        '피검자는 열림과 닫힘 사이에서 끝내 결론을 내리지 못했습니다. 엘리베이터는 그동안 계속 올라갔습니다.',
        '위원회는 피검자의 판단 기준을 분석하려 했으나, 기준이 존재하지 않는다는 결론에 도달했습니다.',
      ] },
  ];

  const BOOT_LINES = [
    { text: 'ELEVATOR_OS v2.6 부팅 중...' },
    { text: '닫힘 버튼 연결 확인... ', tail: 'OK' },
    { text: '탑승자 양심 모듈 로딩... ', pct: 87 },
    { text: '주의: 본 테스트 결과는 인사고과에 반영되지 않습니다(아마도).', warn: true },
  ];

  const PLACEBO_MSG = '<b>[SYSTEM]</b> 참고: 일부 엘리베이터의 닫힘 버튼은 원래 아무 기능이 없습니다. 지금 누르는 그거요.';
  const PLACEBO_END = '<b>[SYSTEM]</b> 닫힘 버튼 기능이 복구되었습니다. 아마도요.';

  const DECO = ['🌵', '🧯', '🚲', '☂️', '🗑️', '🧸', '🛴', '📦', '🌵', '🎈'];
  const SEAL_RING = 'SUDO SEED ★ 승강기 윤리위원회 ★ '.split('');
  const SEGMENTS = {
    0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg',
    5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', ' ': '',
  };

  /* ---------------------------------------------------------
     유틸
     --------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery.matches;
  const onMotion = (e) => { reduced = e.matches; };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotion);
  else if (motionQuery.addListener) motionQuery.addListener(onMotion);

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 환경 */ } },
  };

  function fmtTime(sec) {
    if (sec < 60) return sec.toFixed(2).padStart(5, '0');
    const m = Math.floor(sec / 60);
    return `${m}:${(sec - m * 60).toFixed(2).padStart(5, '0')}`;
  }

  // 표준정규분포 누적확률(상위 N% 계산용)
  function erf(x) {
    const s = Math.sign(x);
    const a = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * a);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
    return s * y;
  }
  const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const pct = (p) => clamp(p, 0.1, 99.9).toFixed(1);

  /* ---------------------------------------------------------
     효과음(Web Audio API로 직접 합성)
     --------------------------------------------------------- */
  const Sound = (() => {
    let ctx = null;
    let master = null;
    let noise = null;
    let on = store.get('closeDoor.sound') !== 'off';

    function unlock() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = on ? 0.9 : 0;
        master.connect(ctx.destination);
        noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    const ready = () => on && ctx && ctx.state !== 'closed';

    function tone(type, freq, t0, dur, peak, opt = {}) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + (opt.attack || 0.004));
      if (opt.hold) g.gain.setValueAtTime(peak, t0 + opt.hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      if (opt.lowpass) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = opt.lowpass;
        o.connect(f);
        f.connect(g);
      } else {
        o.connect(g);
      }
      g.connect(master);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    }

    function burst(t0, dur, peak, lowpass) {
      const s = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      s.buffer = noise;
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      g.gain.setValueAtTime(peak, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f);
      f.connect(g);
      g.connect(master);
      s.start(t0);
      s.stop(t0 + dur + 0.02);
    }

    return {
      unlock,
      get on() { return on; },
      set(v) {
        on = v;
        store.set('closeDoor.sound', v ? 'on' : 'off');
        if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ctx.currentTime, 0.02);
        if (v) unlock();
      },
      // 닫힘 버튼 '삑'
      click() {
        if (!ready()) return;
        const t = ctx.currentTime;
        const f = 1850 + rand(-70, 70);
        tone('square', f, t, 0.045, 0.035, { lowpass: 3800 });
        tone('sine', f, t, 0.06, 0.07);
      },
      // 열림 버튼(조금 낮은 '삑')
      open() {
        if (!ready()) return;
        const t = ctx.currentTime;
        tone('square', 1180, t, 0.05, 0.03, { lowpass: 3000 });
        tone('sine', 1180, t, 0.08, 0.08);
      },
      // 층 이동 '띵'
      ding() {
        if (!ready()) return;
        const t = ctx.currentTime;
        tone('sine', 1318.5, t, 1.6, 0.22, { attack: 0.003 });
        tone('sine', 2637, t, 0.8, 0.05, { attack: 0.003 });
        tone('sine', 3960, t, 0.4, 0.025, { attack: 0.002 });
      },
      // 도착 '띵-동'
      arrive() {
        if (!ready()) return;
        const t = ctx.currentTime;
        tone('sine', 1318.5, t, 1.0, 0.2, { attack: 0.003 });
        tone('sine', 2637, t, 0.5, 0.04, { attack: 0.003 });
        tone('sine', 1046.5, t + 0.32, 1.7, 0.2, { attack: 0.003 });
        tone('sine', 2093, t + 0.32, 0.7, 0.04, { attack: 0.003 });
      },
      // 정원 초과 '삐-'
      overload() {
        if (!ready()) return;
        const t = ctx.currentTime;
        tone('square', 1040, t, 1.25, 0.09, { attack: 0.01, hold: 1.1, lowpass: 2600 });
        tone('sine', 1040, t, 1.25, 0.08, { attack: 0.01, hold: 1.1 });
      },
      // 문틈 손 '쿵'
      thud() {
        if (!ready()) return;
        const t = ctx.currentTime;
        tone('sine', 140, t, 0.22, 0.45, { to: 55 });
        burst(t, 0.09, 0.25, 1400);
      },
      // 판정서 도장 '쾅'
      stamp() {
        if (!ready()) return;
        const t = ctx.currentTime;
        tone('sine', 110, t, 0.32, 0.6, { to: 40 });
        tone('triangle', 220, t, 0.12, 0.15, { to: 90 });
        burst(t, 0.14, 0.4, 900);
      },
    };
  })();

  /* ---------------------------------------------------------
     DOM
     --------------------------------------------------------- */
  const el = {
    main: document.querySelector('main'),
    boot: $('boot'), game: $('game'), result: $('result'),
    term: $('term'), termLines: $('termLines'), termSkip: $('termSkip'),
    bootCta: $('bootCta'), boardBtn: $('boardBtn'),
    soundBtn: $('soundBtn'), soundLabel: $('soundLabel'),
    led: $('led'), ledArrow: $('ledArrow'), segs: [...document.querySelectorAll('.seg')],
    timer: $('timer'), timePop: $('timePop'), cons: $('cons'), consPop: $('consPop'),
    cabin: $('cabin'), doorway: $('doorway'),
    plate: $('plate'), roomL: $('roomL'), roomR: $('roomR'), deco: $('deco'),
    runner: $('runner'), runnerBody: $('runnerBody'), rHead: $('rHead'), rTorso: $('rTorso'), rItem: $('rItem'),
    doorL: $('doorL'), doorR: $('doorR'),
    bubble: $('bubble'), bubbleWho: $('bubbleWho'), bubbleText: $('bubbleText'), gauge: $('gauge'),
    gapline: $('gapline'), hand: $('hand'), banner: $('banner'),
    doorPct: $('doorPct'), doorState: $('doorState'),
    inside: document.querySelector('.inside'), riders: $('riders'), awkBar: $('awkBar'), awkVal: $('awkVal'),
    openBtn: $('openBtn'), closeBtn: $('closeBtn'), ripples: $('ripples'), cpsLayer: $('cpsLayer'),
    cpsNow: $('cpsNow'), cpsMax: $('cpsMax'),
    sysmsg: $('sysmsg'),
    doc: $('doc'), dNo: $('dNo'), dDate: $('dDate'), dRows: $('dRows'),
    dTitle: $('dTitle'), dRank: $('dRank'), dReview: $('dReview'), docTitle: $('docTitle'),
    seal: $('seal'), sealSvg: $('sealSvg'), sealHr: $('sealHr'),
    copyBtn: $('copyBtn'), saveBtn: $('saveBtn'), againBtn: $('againBtn'),
    toast: $('toast'),
  };

  /* ---------------------------------------------------------
     상태
     --------------------------------------------------------- */
  let S = null;
  let loopId = 0;
  let lastFrame = 0;
  let keyAt = 0;
  const timers = new Set();

  function later(ms, fn) {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  }
  function clearTimers() {
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
  }

  function newState() {
    return {
      phase: 'door',     // door | travel | end | result
      floor: 1,
      open: 100,         // 실제 열림 정도(%)
      shown: 0,          // 화면에 보이는 열림 정도(부드럽게 따라감)
      t: 0,              // 게임 시계(초)
      floorT: 0,
      floorPresses: 0,
      travelT: 0,
      ledSwitched: false,
      penalty: 0,
      lock: 0,           // 탑승 중·정원 초과로 문이 강제로 열려 있는 시간
      lockReason: '',
      lastClose: -1,
      final: 0,
      clicks: 0,
      pressTimes: [],
      cps: 0,
      maxCps: 0,
      lastPop: 0,
      cons: 0,
      posMax: 0,
      negMax: 0,
      opened: 0,
      realOpened: 0,
      ignored: 0,
      fooled: 0,
      sheepish: 0,
      handIns: 0,
      placeboClicks: 0,
      awk: 0,
      awkPeak: 0,
      riders: [],
      leaderOpened: false,
      hrFlag: false,
      grandmaIgnored: false,
      plan: [],
      placeboFloor: 0,
      placebo: 'none',   // none | armed | active | done
      placeboT: 0,
      runner: null,
      emptyNoticeFloor: 0,
    };
  }

  // 정차할 층(1~9)마다 달려오는 사람과 플라시보 층을 미리 정한다
  function makePlan(state) {
    const stops = RULES.topFloor - 1;
    const has = Array.from({ length: stops }, () => Math.random() < RULES.runnerChance);
    let count = has.filter(Boolean).length;
    while (count < RULES.runnerMin) {
      const i = Math.floor(Math.random() * stops);
      if (!has[i]) { has[i] = true; count += 1; }
    }

    // 같은 사람은 한 판에 한 번만. 페이크남만 다시 올 수 있다.
    const pool = PEOPLE.map((p) => ({ p, w: p.kind === 'fake' ? 1.15 : 1 }));
    let fakeCount = 0;
    state.plan = has.map((h) => {
      if (!h) return null;
      const total = pool.reduce((s, x) => s + x.w, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length - 1; idx++) {
        r -= pool[idx].w;
        if (r <= 0) break;
      }
      const entry = pool[idx];
      const person = entry.p;
      let variant = 0;
      if (person.kind === 'fake') {
        variant = fakeCount;
        fakeCount += 1;
        entry.w *= 0.7;
      } else {
        pool.splice(idx, 1);
      }
      return { person, variant };
    });

    // 플라시보: 2층 이상, 가능하면 사람이 오지 않는 층
    const quiet = [];
    const any = [];
    for (let f = 2; f <= stops; f++) {
      any.push(f);
      if (!state.plan[f - 1]) quiet.push(f);
    }
    state.placeboFloor = pick(quiet.length ? quiet : any);
  }

  /* ---------------------------------------------------------
     1. 부팅 화면
     --------------------------------------------------------- */
  let bootDone = false;
  let bootTimer = 0;

  function runBoot() {
    el.termLines.innerHTML = '';
    el.bootCta.classList.add('is-waiting');
    bootDone = false;
    if (reduced) { finishBoot(); return; }

    let li = 0;
    let ci = 0;
    let node = null;
    const step = () => {
      if (bootDone) return;
      const line = BOOT_LINES[li];
      if (!line) { finishBoot(); return; }
      if (!node) {
        node = document.createElement('li');
        node.className = 'is-typing';
        if (line.warn) node.classList.add('is-warn');
        el.termLines.appendChild(node);
      }
      if (ci < line.text.length) {
        ci += 1;
        node.textContent = line.text.slice(0, ci);
        bootTimer = setTimeout(step, line.warn ? 20 : 26);
        return;
      }
      if (line.tail) {
        node.insertAdjacentHTML('beforeend', `<span class="ok">${line.tail}</span>`);
      } else if (line.pct) {
        const span = document.createElement('span');
        span.className = 'pct';
        node.appendChild(span);
        let p = 0;
        const count = () => {
          if (bootDone) return;
          p = Math.min(line.pct, p + Math.ceil(rand(3, 9)));
          span.textContent = `${p}%`;
          if (p < line.pct) { bootTimer = setTimeout(count, 40); return; }
          next();
        };
        count();
        return;
      }
      next();
    };
    const next = () => {
      node.classList.remove('is-typing');
      node = null;
      ci = 0;
      li += 1;
      bootTimer = setTimeout(step, 260);
    };
    bootTimer = setTimeout(step, 300);
  }

  function finishBoot() {
    if (bootDone) return;
    bootDone = true;
    clearTimeout(bootTimer);
    el.termLines.innerHTML = BOOT_LINES.map((l) => {
      let tail = '';
      if (l.tail) tail = `<span class="ok">${l.tail}</span>`;
      if (l.pct) tail = `<span class="pct">${l.pct}%</span>`;
      return `<li${l.warn ? ' class="is-warn"' : ''}>${l.text}${tail}</li>`;
    }).join('');
    const last = document.createElement('li');
    last.className = 'is-typing is-warn';
    last.textContent = '탑승하시겠습니까?';
    el.termLines.appendChild(last);
    el.termSkip.hidden = true;
    el.bootCta.classList.remove('is-waiting');
  }

  /* ---------------------------------------------------------
     2. 게임
     --------------------------------------------------------- */
  function showScreen(name) {
    el.boot.hidden = name !== 'boot';
    el.game.hidden = name !== 'game';
    el.result.hidden = name !== 'result';
    window.scrollTo(0, 0);
  }

  function startGame() {
    Sound.unlock();
    clearTimers();
    S = newState();
    makePlan(S);

    el.sysmsg.hidden = true;
    el.bubble.hidden = true;
    el.gapline.hidden = true;
    el.hand.hidden = true;
    el.banner.hidden = true;
    el.runner.hidden = true;
    el.inside.classList.remove('is-awk-max');
    el.openBtn.classList.remove('is-hint');
    renderRiders();
    renderAwk();
    renderCons();
    el.cpsMax.textContent = '0.0';

    showScreen('game');
    el.game.focus({ preventScroll: true });
    setDoors(0);
    startFloor(1);

    cancelAnimationFrame(loopId);
    lastFrame = performance.now();
    loopId = requestAnimationFrame(frame);
  }

  function startFloor(n) {
    S.floor = n;
    S.phase = 'door';
    S.open = 100;
    S.floorT = 0;
    S.floorPresses = 0;
    S.lock = 0;
    setLed(n);
    setCorridor(n);
    el.led.classList.remove('is-moving');
    el.runner.hidden = true;
    el.bubble.hidden = true;

    const entry = S.plan[n - 1];
    S.runner = entry ? {
      person: entry.person,
      variant: entry.variant,
      state: 'pending',
      t: 0,
      t2: 0,
      spawnAt: rand(0.5, 1.4),
      spawnOpen: rand(58, 80),
      side: Math.random() < 0.5 ? 'l' : 'r',
      x: 50,
      scale: 1,
      bubbleUntil: 0,
    } : null;

    if (n === S.placeboFloor && S.placebo === 'none') S.placebo = 'armed';
  }

  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (S && (S.phase === 'door' || S.phase === 'travel')) step(dt);
    render(dt, now);
    if (S && S.phase !== 'result') loopId = requestAnimationFrame(frame);
  }

  function step(dt) {
    S.t += dt;

    if (S.phase === 'travel') {
      S.travelT += dt;
      if (!S.ledSwitched && S.travelT >= RULES.travelSec * 0.55) {
        S.ledSwitched = true;
        setLed(S.floor + 1, true);
      }
      if (S.travelT >= RULES.travelSec) arriveNext();
      return;
    }

    S.floorT += dt;

    if (S.lock > 0) {
      S.lock -= dt;
      S.open = 100;
      if (S.lock <= 0) { S.lock = 0; S.lockReason = ''; }
    } else {
      S.open = Math.min(100, S.open + RULES.reopenPerSec * dt);
    }

    // 플라시보: 이 층에서 연타를 시작하면 3초 동안 닫힘 버튼이 '작동하지 않는다'
    if (S.placebo === 'armed' && S.floorT >= 0.45 && S.floorPresses >= 2) startPlacebo();
    if (S.placebo === 'active') {
      S.placeboT += dt;
      if (S.placeboT >= RULES.placeboSec) endPlacebo();
    }

    const r = S.runner;
    if (r) {
      if (r.state === 'pending' && (S.floorT >= r.spawnAt || S.open <= r.spawnOpen)) spawnRunner();
      else if (r.state === 'running') {
        r.t += dt;
        if (r.t >= RULES.arriveSec) runnerArrives();
      } else if (r.state === 'boarding' || r.state === 'leaving') {
        r.t2 += dt;
        if (r.t2 >= r.dur) finishMove();
      }
    }
  }

  /* ---------- 버튼 ---------- */
  function pressClose() {
    if (!S || S.phase === 'result') return;
    Sound.click();
    bump(el.closeBtn);
    ripple();
    if (S.phase === 'end') return;
    S.clicks += 1;
    S.lastClose = S.t;
    trackCps();
    if (S.phase !== 'door') return;
    S.floorPresses += 1;
    if (S.lock > 0) return;
    if (S.placebo === 'active') { S.placeboClicks += 1; return; }
    S.open = Math.max(0, S.open - rand(RULES.closeMin, RULES.closeMax));
    if (S.open <= 0) doorClosed();
  }

  function pressOpen() {
    if (!S || S.phase === 'result') return;
    Sound.open();
    bump(el.openBtn);
    if (S.phase === 'end') return;
    S.clicks += 1;
    if (S.phase !== 'door') return;

    const r = S.runner;
    if (r && r.state === 'running') { acceptRunner(); return; }
    S.open = 100;
    const busy = r && (r.state === 'boarding' || r.state === 'leaving');
    if (!busy && S.emptyNoticeFloor !== S.floor) {
      S.emptyNoticeFloor = S.floor;
      toast('복도에는 아무도 없습니다.');
    }
  }

  function trackCps() {
    const now = performance.now();
    const list = S.pressTimes;
    list.push(now);
    while (list.length && now - list[0] > 1000) list.shift();
    const n = list.length;
    let cps = 0;
    if (n >= 3) cps = (n - 1) / Math.max((now - list[0]) / 1000, 0.25);
    cps = Math.min(cps, 30);
    S.cps = cps;
    if (n >= 5 && cps > S.maxCps) {
      S.maxCps = cps;
      el.cpsMax.textContent = cps.toFixed(1);
    }
    if (cps >= 6 && now - S.lastPop > 280) {
      S.lastPop = now;
      cpsPop(cps);
    }
  }

  /* ---------- 달려오는 사람 ---------- */
  function spawnRunner() {
    const r = S.runner;
    const p = r.person;
    r.state = 'running';
    r.t = 0;
    if (p.board > 0) S.posMax += p.board;
    if (p.ignore < 0) S.negMax += p.ignore;

    el.rHead.textContent = p.head;
    el.rItem.innerHTML = p.item;
    el.rItem.hidden = !p.item;
    el.runnerBody.style.setProperty('--torso', p.torso);
    el.runnerBody.style.setProperty('--legs', p.legs);
    el.runnerBody.style.setProperty('--mark', p.mark || 'transparent');
    el.runnerBody.style.setProperty('--mark-w', p.markW || '0');
    el.rItem.style.display = p.stack ? 'flex' : '';
    el.rItem.style.flexDirection = 'column';
    el.rItem.style.alignItems = 'center';
    el.rItem.style.lineHeight = p.stack ? '.92' : '';
    el.rItem.style.fontSize = p.stack ? '1.05em' : '';
    el.rItem.style.top = p.stack ? 'auto' : '';
    el.rItem.style.bottom = p.stack ? '2.4em' : '';
    el.runner.classList.toggle('from-r', r.side === 'r');
    el.runner.classList.add('is-running');
    el.runner.style.opacity = '1';
    el.runner.hidden = false;

    const line = p.kind === 'fake' ? p.lines[Math.min(r.variant, p.lines.length - 1)] : p.line;
    say(p.name, line, true);
    el.openBtn.classList.add('is-hint');
  }

  function say(who, text, fresh) {
    el.bubbleWho.textContent = who;
    el.bubbleText.textContent = text;
    el.bubble.classList.toggle('is-done', !fresh);
    el.bubble.classList.toggle('is-talk', !!fresh);
    el.bubble.hidden = false;
    el.bubble.classList.remove('is-pop');
    void el.bubble.offsetWidth;
    el.bubble.classList.add('is-pop');
    if (S.runner) S.runner.bubbleUntil = fresh ? 0 : S.t + 1.4;
  }

  function moveRunner(state, toX, dur, toScale, fade) {
    const r = S.runner;
    r.state = state;
    r.t2 = 0;
    r.dur = dur;
    r.fromX = r.x;
    r.toX = toX;
    r.fromScale = r.scale;
    r.toScale = toScale;
    r.fade = fade;
    el.runner.classList.toggle('is-running', state === 'leaving');
  }

  // 열림 버튼으로 태워 줌
  function acceptRunner() {
    const r = S.runner;
    const p = r.person;
    S.open = 100;
    S.penalty += RULES.openPenalty;
    S.opened += 1;
    popHud(el.timePop, `+${RULES.openPenalty}s`, false);
    el.openBtn.classList.remove('is-hint');

    if (p.kind === 'fake') {
      S.fooled += 1;
      say(p.name, p.reveals[Math.min(r.variant, p.reveals.length - 1)], false);
      moveRunner('leaving', r.side === 'l' ? -25 : 125, 0.9, r.scale, true);
      banner('속았다 +1', true);
      return;
    }
    if (p.kind === 'gym') {
      S.sheepish += 1;
      say(p.name, p.reveal, false);
      moveRunner('leaving', r.side === 'l' ? 125 : -25, 1.1, r.scale, true);
      banner('머쓱…', false);
      return;
    }

    changeCons(p.board);
    if (p.kind === 'normal') S.realOpened += 1;
    if (p.leader) S.leaderOpened = true;
    say(p.name, p.thanks, false);
    board();
  }

  function board() {
    S.lock = Math.max(S.lock, 0.55);
    S.lockReason = '탑승 중';
    moveRunner('boarding', 50, 0.5, 1.55, true);
  }

  // 도착 시간(2.5초)이 됐는데 문이 덜 닫혀 있음
  function runnerArrives() {
    const r = S.runner;
    const p = r.person;
    el.openBtn.classList.remove('is-hint');

    if (p.kind === 'fake') {
      say(p.name, p.reveals[Math.min(r.variant, p.reveals.length - 1)], false);
      moveRunner('leaving', r.side === 'l' ? -25 : 125, 0.9, r.scale, true);
      return;
    }
    if (p.kind === 'gym') {
      say(p.name, p.reveal, false);
      moveRunner('leaving', r.side === 'l' ? 125 : -25, 1.1, r.scale, true);
      return;
    }

    if (S.open < 99.5) {
      // 문틈에 손 넣기: 문이 강제로 열리고 화면이 흔들린다. 양심 변화 없음.
      S.handIns += 1;
      show(el.hand, 900);
      shake(el.cabin);
      Sound.thud();
      say(p.name, p.kind === 'overload' ? p.line : '휴~ 감사합니다~', false);
    } else {
      say(p.name, p.thanks || '감사합니다~', false);
    }
    S.open = 100;
    board();
  }

  function finishMove() {
    const r = S.runner;
    if (r.state === 'boarding') {
      el.runner.hidden = true;
      const p = r.person;
      if (p.kind === 'overload') { overload(); return; }
      addRider(p);
      r.state = 'gone';
      return;
    }
    el.runner.hidden = true;
    el.runner.classList.remove('is-running');
    r.state = 'gone';
  }

  function overload() {
    const r = S.runner;
    const p = r.person;
    Sound.overload();
    S.lock = 1.4;
    S.lockReason = '정원 초과';
    S.open = 100;
    banner('정원 초과 삐-', true);
    r.x = 50;
    r.scale = 1.2;
    el.runner.style.opacity = '1';
    el.runner.hidden = false;
    say(p.name, p.exit, false);
    moveRunner('leaving', r.side === 'l' ? -25 : 125, 1.3, 1.05, true);
  }

  function addRider(p) {
    S.riders.push(p);
    if (p.awk === 'max') S.awk = 100;
    else S.awk = clamp(S.awk + p.awk, 0, 100);
    S.awkPeak = Math.max(S.awkPeak, S.awk);
    renderRiders();
    renderAwk();
  }

  // 문이 끝까지 닫힘 → 띵, 다음 층으로
  function doorClosed() {
    S.open = 0;
    const r = S.runner;
    if (r && r.state === 'running') {
      const p = r.person;
      if (p.kind === 'fake') {
        gap(p.gap);
      } else if (p.kind !== 'gym') {
        changeCons(p.ignore);
        S.ignored += 1;
        if (p.leader) S.hrFlag = true;
        if (p.id === 'grandma') S.grandmaIgnored = true;
        gap(p.gap);
      }
    }
    if (r) r.state = 'gone';
    el.runner.hidden = true;
    el.bubble.hidden = true;
    el.openBtn.classList.remove('is-hint');
    if (S.placebo === 'active') endPlacebo();

    Sound.ding();
    S.phase = 'travel';
    S.travelT = 0;
    S.ledSwitched = false;
    el.led.classList.add('is-moving');
  }

  function arriveNext() {
    const n = S.floor + 1;
    if (n < RULES.topFloor) { startFloor(n); return; }

    // 10층 도착
    S.floor = n;
    S.phase = 'end';
    S.final = S.t + S.penalty;
    S.open = 100;
    setLed(n);
    setCorridor(n);
    el.led.classList.remove('is-moving');
    Sound.arrive();
    banner(`${n}F 도착 · 목적지입니다`, false, 1800);
    later(1900, showResult);
  }

  /* ---------- 플라시보 ---------- */
  function startPlacebo() {
    S.placebo = 'active';
    S.placeboT = 0;
    later(650, () => {
      if (!S || S.phase === 'result') return;
      el.sysmsg.innerHTML = PLACEBO_MSG;
      el.sysmsg.hidden = false;
    });
  }
  function endPlacebo() {
    S.placebo = 'done';
    later(700, () => {
      if (!S || S.phase === 'result') return;
      el.sysmsg.innerHTML = PLACEBO_END;
      el.sysmsg.hidden = false;
      later(2400, () => { el.sysmsg.hidden = true; });
    });
  }

  /* ---------- 점수 ---------- */
  function changeCons(d) {
    if (!d) return;
    S.cons += d;
    renderCons();
    popHud(el.consPop, signed(d), d > 0);
  }

  /* ---------------------------------------------------------
     렌더링
     --------------------------------------------------------- */
  let lastDoor = -1;

  function setDoors(v) {
    const x = Math.round(v * 10) / 10;
    if (x === lastDoor) return;
    lastDoor = x;
    el.doorL.style.transform = `translateX(${-x}%)`;
    el.doorR.style.transform = `translateX(${x}%)`;
  }

  function render(dt, now) {
    if (!S) return;

    // 문: 실제 값(open)을 부드럽게 따라간다. 동작 줄이기면 즉시.
    if (reduced) S.shown = S.open;
    else {
      const k = S.open > S.shown ? 7 : 20;
      S.shown += (S.open - S.shown) * (1 - Math.exp(-dt * k));
      if (Math.abs(S.open - S.shown) < 0.05) S.shown = S.open;
    }
    setDoors(S.shown);

    const openPct = Math.round(S.open);
    el.doorPct.textContent = `${openPct}%`;
    let state = '열림';
    let red = false;
    if (S.phase === 'travel') state = '운행 중 ▲';
    else if (S.phase === 'end') state = '도착';
    else if (S.lock > 0) { state = S.lockReason; red = S.lockReason === '정원 초과'; }
    else if (openPct <= 0) state = '닫힘';
    else if (openPct < 100) state = S.t - S.lastClose < 0.25 ? '닫히는 중' : '다시 열리는 중';
    if (el.doorState.textContent !== state) el.doorState.textContent = state;
    el.doorState.classList.toggle('is-red', red);

    const total = S.phase === 'end' || S.phase === 'result' ? S.final : S.t + S.penalty;
    el.timer.textContent = fmtTime(total);

    const live = performance.now() - (S.pressTimes[S.pressTimes.length - 1] || 0) < 500 ? S.cps : 0;
    el.cpsNow.textContent = live.toFixed(1);
    el.closeBtn.classList.toggle('is-hot', live >= 8);

    // 달려오는 사람
    const r = S.runner;
    if (r && r.state !== 'pending' && r.state !== 'gone') {
      let opacity = 1;
      if (r.state === 'running') {
        const p = clamp(r.t / RULES.arriveSec, 0, 1);
        const start = r.side === 'l' ? -12 : 112;
        r.x = lerp(start, 50, easeOut(p));
        r.scale = lerp(0.7, 1.15, p);
        el.gauge.style.transform = `scaleX(${1 - p})`;
      } else {
        const p = clamp(r.t2 / r.dur, 0, 1);
        r.x = lerp(r.fromX, r.toX, r.state === 'boarding' ? easeOut(p) : p);
        r.scale = lerp(r.fromScale, r.toScale, p);
        if (r.fade) opacity = r.state === 'boarding' ? 1 - Math.max(0, (p - 0.45) / 0.55) : 1 - Math.max(0, (p - 0.6) / 0.4);
      }
      el.runner.style.left = `${r.x}%`;
      el.runnerBody.style.transform = `scale(${r.scale.toFixed(3)})`;
      el.runner.style.opacity = opacity.toFixed(2);
      placeBubble(r.x);
      if (r.bubbleUntil && S.t > r.bubbleUntil) { el.bubble.hidden = true; r.bubbleUntil = 0; }
    } else if (r && r.bubbleUntil && S.t > r.bubbleUntil) {
      el.bubble.hidden = true;
      r.bubbleUntil = 0;
    }
  }

  // 말풍선은 문 위 레이어에 떠서 사람을 따라다닌다(꼬리가 사람을 가리킴)
  function placeBubble(xPct) {
    if (el.bubble.hidden) return;
    const W = el.doorway.clientWidth;
    const bw = el.bubble.offsetWidth;
    const x = (xPct / 100) * W;
    const left = clamp(x, bw / 2 + 6, W - bw / 2 - 6);
    el.bubble.style.left = `${left}px`;
    const tail = clamp(x - (left - bw / 2), 16, bw - 16);
    el.bubble.style.setProperty('--tail', `${tail}px`);
  }

  function setLed(n, flip) {
    const s = String(n).padStart(2, ' ');
    el.segs.forEach((seg, i) => {
      const on = SEGMENTS[s[i]] || '';
      seg.querySelectorAll('i').forEach((sg) => sg.classList.toggle('on', on.includes(sg.className.charAt(0))));
    });
    el.led.setAttribute('aria-label', `${n}층`);
    if (flip && !reduced) {
      el.led.classList.remove('is-flip');
      void el.led.offsetWidth;
      el.led.classList.add('is-flip');
    }
  }

  function setCorridor(n) {
    el.plate.textContent = `${n}F`;
    el.roomL.textContent = `${n}01`;
    el.roomR.textContent = `${n}02`;
    el.deco.textContent = DECO[(n - 1) % DECO.length];
  }

  function renderCons() {
    el.cons.textContent = signed(S.cons);
    el.cons.classList.toggle('is-neg', S.cons < 0);
  }

  function renderRiders() {
    if (!S.riders.length) { el.riders.innerHTML = '<em>나 혼자</em>'; return; }
    el.riders.textContent = S.riders.map((p) => p.head).join(' ');
    el.riders.setAttribute('aria-label', S.riders.map((p) => p.name).join(', '));
  }

  function renderAwk() {
    const max = S.awk >= 100;
    el.awkBar.style.width = `${S.awk}%`;
    el.awkVal.textContent = max ? 'MAX' : `${S.awk}%`;
    el.inside.classList.toggle('is-awk-max', max);
  }

  /* ---------- 연출 ---------- */
  function bump(btn) {
    btn.classList.remove('is-pressed');
    void btn.offsetWidth;
    btn.classList.add('is-pressed');
  }

  function ripple() {
    if (reduced) return;
    if (el.ripples.childElementCount > 6) el.ripples.firstElementChild.remove();
    const r = document.createElement('span');
    r.className = 'ripple';
    el.ripples.appendChild(r);
    setTimeout(() => r.remove(), 500);
  }

  function cpsPop(cps) {
    if (reduced) return;
    const pop = document.createElement('span');
    pop.className = `cps-pop${cps >= 11 ? ' is-big' : ''}`;
    pop.textContent = `CPS ${cps.toFixed(1)}!`;
    // 닫힘 버튼(오른쪽 약 59%) 위에서 튀어 오른다
    pop.style.left = `${rand(52, 92)}%`;
    el.cpsLayer.appendChild(pop);
    setTimeout(() => pop.remove(), 850);
  }

  function popHud(node, text, up) {
    node.textContent = text;
    node.classList.toggle('is-up', up);
    node.classList.remove('is-on');
    void node.offsetWidth;
    node.classList.add('is-on');
  }

  function show(node, ms) {
    node.hidden = false;
    node.style.animation = 'none';
    void node.offsetWidth;
    node.style.animation = '';
    clearTimeout(node._hide);
    node._hide = setTimeout(() => { node.hidden = true; }, ms);
  }

  function gap(text) {
    if (!text) return;
    el.gapline.textContent = text;
    show(el.gapline, 1150);
  }

  function banner(text, red, ms = 1100) {
    el.banner.textContent = text;
    el.banner.classList.toggle('is-red', !!red);
    show(el.banner, ms);
  }

  function shake(node) {
    if (reduced) return;
    node.classList.remove('is-shake');
    void node.offsetWidth;
    node.classList.add('is-shake');
    setTimeout(() => node.classList.remove('is-shake'), 420);
  }

  let toastTimer = 0;
  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), 1600);
  }

  /* ---------------------------------------------------------
     3. 판정
     --------------------------------------------------------- */
  function judge() {
    const time = S.final;
    const cons = S.cons;
    // q: 이번 판에서 가능한 양심 점수 대비 실제 점수(-1 ~ 1)
    let q = 0;
    if (cons > 0 && S.posMax > 0) q = cons / S.posMax;
    if (cons < 0 && S.negMax < 0) q = -(cons / S.negMax);
    q = clamp(q, -1, 1);
    // z: 이기심 지수. 양심이 낮고 빠를수록 높다. 느리다고 착해지지는 않으므로 시간 쪽 감점은 작게.
    const z = -1.55 * q + 0.45 * clamp((TIME.mid - time) / TIME.sd, -0.5, 1.5);

    const v = {
      time, cons, q, z,
      maxCps: S.maxCps,
      opened: S.opened,
      realOpened: S.realOpened,
      ignored: S.ignored,
      fooled: S.fooled,
      handIns: S.handIns,
      leaderOpened: S.leaderOpened,
      grandmaIgnored: S.grandmaIgnored,
      selfPct: pct((1 - phi(z)) * 100),
      kindPct: pct(phi(z) * 100),
    };
    const title = TITLES.find((t) => t.test(v));
    v.title = title.name(v);
    v.rank = z >= 0 ? `이기심 지수 상위 ${v.selfPct}%` : `양심 지수 상위 ${v.kindPct}%`;
    v.review = pick(title.lines)
      .replace('{fooled}', S.fooled)
      .replace('{time}', S.penalty.toFixed(1))
      .replace('{handIns}', S.handIns)
      .replace('{cps}', S.maxCps.toFixed(1));
    return v;
  }

  function docRows(v) {
    const pen = S.penalty > 0 ? ` <small>(페널티 +${S.penalty.toFixed(1)}초)</small>` : '';
    return [
      ['총 소요 시간', `${v.time.toFixed(2)}초${pen}`, `${v.time.toFixed(2)}초`],
      ['총 클릭 수', `${S.clicks}회`],
      ['최고 연타 속도', `${S.maxCps.toFixed(1)} CPS`],
      ['양심 점수', signed(S.cons), null, S.cons < 0],
      ['열어준 횟수 / 무시한 횟수', `${S.opened}회 / ${S.ignored}회`],
      ['속은 횟수', `${S.fooled}회`],
      ['문틈 손 끼임', `${S.handIns}회`],
      ['기능 없는 닫힘 버튼 클릭', `${S.placeboClicks}회`],
      ['엘리베이터 내 어색함', S.awkPeak >= 100 ? 'MAX' : `${S.awkPeak}%`],
    ];
  }

  let verdict = null;

  function showResult() {
    S.phase = 'result';
    cancelAnimationFrame(loopId);
    el.sysmsg.hidden = true;

    const v = judge();
    const now = new Date();
    v.no = `CD-${now.getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
    v.date = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
    v.rows = docRows(v);
    v.hr = S.hrFlag;
    verdict = v;

    el.dNo.textContent = v.no;
    el.dDate.textContent = v.date;
    el.dRows.innerHTML = v.rows.map(([k, val, , red]) => `<tr><th scope="row">${k}</th><td${red ? ' class="is-red"' : ''}>${val}</td></tr>`).join('');
    el.dTitle.textContent = v.title;
    el.dRank.textContent = v.rank;
    el.dReview.textContent = v.review;

    el.copyBtn.textContent = '결과 복사';
    el.saveBtn.textContent = '판정서 이미지 저장';
    el.seal.classList.remove('is-stamp');
    el.sealHr.classList.remove('is-stamp');
    el.seal.style.visibility = 'hidden';
    el.sealHr.hidden = !v.hr;
    el.sealHr.style.visibility = 'hidden';

    showScreen('result');
    el.docTitle.focus({ preventScroll: true });

    // 도장이 위에서 쾅
    later(reduced ? 0 : 450, () => stampIt(el.seal));
    if (v.hr) later(reduced ? 0 : 1150, () => stampIt(el.sealHr));
  }

  function stampIt(node) {
    node.style.visibility = '';
    node.classList.remove('is-stamp');
    void node.offsetWidth;
    node.classList.add('is-stamp');
    later(reduced ? 0 : 290, () => {
      Sound.stamp();
      shake(el.main);
    });
  }

  /* ---------- 결과 복사 ---------- */
  function resultText(v) {
    const lines = [
      '[엘리베이터 탑승 태도 공식 판정서]',
      `문서번호 ${v.no} · 발급일 ${v.date}`,
      '',
      `▶ 칭호: ${v.title}`,
      `▶ ${v.rank}`,
      '',
      ...v.rows.map(([k, val, plain]) => `· ${k}: ${(plain || val).replace(/<[^>]+>/g, '')}`),
      '',
      `총평: ${v.review}`,
    ];
    if (v.hr) lines.push('', '[인사고과 -1] 팀장님을 두고 문을 닫았습니다.');
    lines.push('', '— SUDO SEED 승강기 윤리위원회', `CLOSE_DOOR · ${SEED} · SUDO SEED`, SITE_URL);
    return lines.join('\n');
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* 아래 방법으로 */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  function flash(btn, text, base) {
    btn.textContent = text;
    btn.classList.add('is-done');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.textContent = base;
      btn.classList.remove('is-done');
    }, 1600);
  }

  /* ---------------------------------------------------------
     판정서 이미지(Canvas API로 직접 그림)
     --------------------------------------------------------- */
  const FONT_SANS = 'system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  const FONT_MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "D2Coding", monospace';
  const C = { bg: '#000', paper: '#f4f3ee', line: '#cfcdc4', ink: '#111', soft: '#5d5c57', red: '#ff2a2a' };

  function wrap(ctx, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    const push = (w) => {
      // 한 단어가 너무 길면 글자 단위로 자른다
      if (ctx.measureText(w).width <= maxW) return [w];
      const parts = [];
      let buf = '';
      for (const ch of w) {
        if (ctx.measureText(buf + ch).width > maxW && buf) { parts.push(buf); buf = ch; } else buf += ch;
      }
      if (buf) parts.push(buf);
      return parts;
    };
    words.forEach((w) => {
      const test = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(test).width <= maxW) { cur = test; return; }
      if (cur) lines.push(cur);
      const parts = push(w);
      cur = parts.pop();
      lines.push(...parts);
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function sealCanvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const k = size / 200;
    x.scale(k, k);
    x.strokeStyle = x.fillStyle = C.red;
    x.lineWidth = 7;
    x.beginPath(); x.arc(100, 100, 93, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 3;
    x.beginPath(); x.arc(100, 100, 53, 0, Math.PI * 2); x.stroke();
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `800 17px ${FONT_SANS}`;
    SEAL_RING.forEach((ch, i) => {
      if (ch === ' ') return;
      x.save();
      x.translate(100, 100);
      x.rotate((i * Math.PI * 2) / SEAL_RING.length);
      x.fillText(ch, 0, -72);
      x.restore();
    });
    x.font = `900 30px ${FONT_SANS}`;
    x.fillText('판정', 100, 96);
    x.font = `800 14px ${FONT_SANS}`;
    x.fillText('완 료', 100, 124);
    // 인주가 덜 묻은 자국
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 140; i++) {
      x.globalAlpha = rand(0.15, 0.6);
      x.beginPath();
      x.arc(rand(0, 200), rand(0, 200), rand(0.4, 1.8), 0, Math.PI * 2);
      x.fill();
    }
    return c;
  }

  function hrCanvas() {
    const c = document.createElement('canvas');
    c.width = 300; c.height = 110;
    const x = c.getContext('2d');
    x.strokeStyle = x.fillStyle = C.red;
    x.lineWidth = 5; x.strokeRect(6, 6, 288, 98);
    x.lineWidth = 2; x.strokeRect(16, 16, 268, 78);
    x.textBaseline = 'middle';
    x.font = `900 36px ${FONT_SANS}`;
    x.fillText('인사고과', 34, 56);
    x.font = `900 48px ${FONT_MONO}`;
    x.fillText('-1', 196, 58);
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 90; i++) {
      x.globalAlpha = rand(0.15, 0.55);
      x.beginPath();
      x.arc(rand(0, 300), rand(0, 110), rand(0.4, 1.6), 0, Math.PI * 2);
      x.fill();
    }
    return c;
  }

  // draw=false로 한 번 돌려 높이를 재고, 그 높이로 다시 그린다
  function layoutDoc(ctx, v, draw) {
    const W = 1080;
    const M = 40;          // 바깥 여백
    const L = M + 64;      // 본문 왼쪽
    const R = W - M - 64;  // 본문 오른쪽
    const CW = R - L;
    let y = M + 70;

    const text = (s, x, yy, font, color, align = 'left') => {
      if (!draw) return;
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.fillText(s, x, yy);
    };
    const rule = (yy, w = 1, color = C.line) => {
      if (!draw) return;
      ctx.fillStyle = color;
      ctx.fillRect(L, yy, CW, w);
    };

    text('SUDO SEED 승강기 윤리위원회', L, y, `700 22px ${FONT_MONO}`, C.ink);
    text('ELEVATOR_OS v2.6', R, y, `700 22px ${FONT_MONO}`, C.ink, 'right');
    y += 20;
    rule(y, 4, C.ink);

    y += 96;
    text('엘리베이터 탑승 태도', W / 2, y, `900 62px ${FONT_SANS}`, C.ink, 'center');
    y += 78;
    text('공식 판정서', W / 2, y, `900 62px ${FONT_SANS}`, C.ink, 'center');

    y += 46;
    rule(y);
    y += 40;
    text(`문서번호 ${v.no}`, L, y, `600 24px ${FONT_MONO}`, C.ink);
    text(`발급일 ${v.date}`, R, y, `600 24px ${FONT_SANS}`, C.ink, 'right');
    y += 22;
    rule(y);

    y += 62;
    text('탑 승 기 록', L, y, `800 21px ${FONT_SANS}`, C.soft);
    y += 18;
    rule(y, 4, C.ink);
    v.rows.forEach(([k, , plain, red], i) => {
      const val = (plain || v.rows[i][1]).replace(/<[^>]+>/g, '');
      y += 46;
      text(k, L, y, `500 26px ${FONT_SANS}`, C.soft);
      text(val, R, y, `700 28px ${FONT_MONO}`, red ? C.red : C.ink, 'right');
      y += 20;
      rule(y);
    });
    if (S.penalty > 0) {
      y += 34;
      text(`* 총 소요 시간에는 열림 페널티 +${S.penalty.toFixed(1)}초가 포함되어 있습니다.`, L, y, `400 20px ${FONT_SANS}`, C.soft);
    }

    // 칭호 상자
    y += 40;
    const boxTop = y;
    ctx.font = `900 56px ${FONT_SANS}`;
    const tLines = wrap(ctx, v.title, CW - 80);
    y += 50;
    text('칭 호', W / 2, y, `800 21px ${FONT_SANS}`, C.soft, 'center');
    tLines.forEach((ln) => {
      y += 72;
      text(ln, W / 2, y, `900 56px ${FONT_SANS}`, C.ink, 'center');
    });
    y += 54;
    text(v.rank, W / 2, y, `800 28px ${FONT_MONO}`, C.red, 'center');
    y += 36;
    if (draw) {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      ctx.strokeRect(L, boxTop, CW, y - boxTop);
      if (v.hr) {
        // 인사고과 도장: 칭호 상자 오른쪽 위 모서리에 걸쳐 찍는다
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.9;
        ctx.translate(R - 120, boxTop + 4);
        ctx.rotate((8 * Math.PI) / 180);
        ctx.drawImage(hrCanvas(), -150, -55);
        ctx.restore();
      }
    }

    // 총평
    y += 64;
    text('총 평', L, y, `800 21px ${FONT_SANS}`, C.soft);
    ctx.font = `500 29px ${FONT_SANS}`;
    const rLines = wrap(ctx, v.review, CW);
    rLines.forEach((ln) => {
      y += 48;
      text(ln, L, y, `500 29px ${FONT_SANS}`, C.ink);
    });

    // 꼬리말 + 서명
    y += 44;
    rule(y);
    y += 50;
    text('위 탑승자의 엘리베이터 탑승 태도를 상기와 같이 판정합니다.', L, y, `500 23px ${FONT_SANS}`, C.soft);
    y += 36;
    text('본 판정서는 인사고과에 반영되지 않습니다(아마도).', L, y, `400 20px ${FONT_SANS}`, C.soft);
    y += 84;
    const signY = y;
    text('SUDO SEED 승강기 윤리위원회', R - 120, y, `900 32px ${FONT_SANS}`, C.ink, 'right');
    y += 104;
    text(SITE_URL.replace('https://', ''), L, y, `500 20px ${FONT_MONO}`, C.soft);
    text(`CLOSE_DOOR · ${SEED}`, R, y, `500 20px ${FONT_MONO}`, C.soft, 'right');
    y += 52;

    if (draw) {
      // 도장: 서명 위에 겹쳐 찍는다
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.9;
      ctx.translate(R - 112, signY - 22);
      ctx.rotate((-14 * Math.PI) / 180);
      ctx.drawImage(sealCanvas(230), -115, -115, 230, 230);
      ctx.restore();
    }
    return y + M;
  }

  function drawDoc(v) {
    const W = 1080;
    const probe = document.createElement('canvas').getContext('2d');
    const H = Math.ceil(layoutDoc(probe, v, false));
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.paper;
    ctx.fillRect(40, 40, W - 80, H - 80);
    ctx.textBaseline = 'alphabetic';
    layoutDoc(ctx, v, true);
    return canvas;
  }

  function saveImage() {
    if (!verdict) return;
    const canvas = drawDoc(verdict);
    const name = `CLOSE_DOOR_${verdict.no}.png`;
    const done = (url, revoke) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (revoke) setTimeout(() => URL.revokeObjectURL(url), 4000);
      flash(el.saveBtn, '저장 완료 ✓', '판정서 이미지 저장');
    };
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (blob) done(URL.createObjectURL(blob), true);
        else done(canvas.toDataURL('image/png'), false);
      }, 'image/png');
    } else {
      done(canvas.toDataURL('image/png'), false);
    }
  }

  function buildSealSvg() {
    let html = '<circle cx="100" cy="100" r="93" fill="none" stroke="currentColor" stroke-width="7"/>'
      + '<circle cx="100" cy="100" r="53" fill="none" stroke="currentColor" stroke-width="3"/>';
    SEAL_RING.forEach((ch, i) => {
      if (ch === ' ') return;
      const deg = ((i * 360) / SEAL_RING.length).toFixed(2);
      html += `<text x="100" y="28" text-anchor="middle" dominant-baseline="central" font-size="17" font-weight="800" fill="currentColor" transform="rotate(${deg} 100 100)">${ch}</text>`;
    });
    html += '<text x="100" y="96" text-anchor="middle" dominant-baseline="central" font-size="30" font-weight="900" fill="currentColor">판정</text>'
      + '<text x="100" y="124" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="800" fill="currentColor">완 료</text>';
    el.sealSvg.innerHTML = html;
  }

  /* ---------------------------------------------------------
     입력
     --------------------------------------------------------- */
  function bindPress(btn, fn) {
    btn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      fn();
    });
    // 키보드는 아래 keydown에서 처리. 보조기기가 보내는 click(detail 0)만 따로 받는다.
    btn.addEventListener('click', (e) => {
      if (e.detail === 0 && performance.now() - keyAt > 300) fn();
    });
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  bindPress(el.closeBtn, pressClose);
  bindPress(el.openBtn, pressOpen);

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const isClose = e.code === 'Space' || e.key === ' ';
    const isOpen = e.code === 'KeyO' || e.key === 'o' || e.key === 'O' || e.key === 'ㅐ' || e.key === 'Enter';

    if (!el.boot.hidden) {
      // 부팅 화면: 아무 키나 누르면 타이핑을 건너뛰고, 다 나온 뒤엔 스페이스/엔터로 탑승
      const onButton = e.target instanceof HTMLButtonElement;
      if (!bootDone) { if (isClose || isOpen) e.preventDefault(); finishBoot(); return; }
      if ((isClose || e.key === 'Enter') && !onButton) { e.preventDefault(); startGame(); }
      return;
    }
    if (el.game.hidden || !S) return;
    if (!isClose && !isOpen) return;
    e.preventDefault();
    if (e.repeat) return; // 꾹 누르기 자동 반복은 연타로 치지 않는다
    keyAt = performance.now();
    const a = document.activeElement;
    if (a && a !== document.body && a !== el.game && a.blur) a.blur();
    if (isClose) pressClose(); else pressOpen();
  });

  el.term.addEventListener('click', finishBoot);
  el.boardBtn.addEventListener('click', startGame);
  el.againBtn.addEventListener('click', startGame);

  el.copyBtn.addEventListener('click', async () => {
    if (!verdict) return;
    const ok = await copyText(resultText(verdict));
    if (ok) flash(el.copyBtn, '복사 완료 ✓', '결과 복사');
    else toast('복사하지 못했습니다. 브라우저 권한을 확인해 주세요.');
  });
  el.saveBtn.addEventListener('click', saveImage);

  function renderSound() {
    const on = Sound.on;
    el.soundBtn.setAttribute('aria-pressed', String(on));
    el.soundBtn.setAttribute('aria-label', on ? '효과음 끄기' : '효과음 켜기');
    el.soundLabel.textContent = on ? 'ON' : 'OFF';
  }
  el.soundBtn.addEventListener('click', () => {
    Sound.set(!Sound.on);
    renderSound();
    if (Sound.on) Sound.click();
  });

  /* ---------------------------------------------------------
     시작
     --------------------------------------------------------- */
  buildSealSvg();
  renderSound();
  runBoot();
})();
