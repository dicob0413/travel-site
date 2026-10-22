// 카카오 디벨로퍼스(https://developers.kakao.com)에서 발급받은 JavaScript 키.
// 비워두면 휴대폰 기본 공유창(→ 카카오톡 선택) 또는 텍스트 복사로 동작합니다.
const KAKAO_JS_KEY = '';
// 미리보기(claude.ai 등)처럼 링크 공유가 안 되는 곳에 올릴 때 true
const PREVIEW = !!window.NBBANG_PREVIEW;

const { calculate } = window.NBbang;
const $ = (id) => document.getElementById(id);
const won = (n) => n.toLocaleString('ko-KR');
const DRAFT_KEY = 'nbbang:draft';
const WEIGHTS = [
  [0.5, '0.5배'],
  [0.8, '0.8배 (막내)'],
  [1, '1배'],
  [1.2, '1.2배'],
  [1.5, '1.5배 (선배)'],
  [2, '2배'],
];

let seq = 0;
const uid = (p) => `${p}${Date.now().toString(36)}${seq++}`;

function blankState() {
  return { title: '', unit: 100, treasurer: null, account: '', people: [], rounds: [newRound(1, [])] };
}

function newRound(n, attendees) {
  return { id: uid('r'), name: `${n}차`, food: 0, alcohol: 0, payer: null, attendees, glasses: {} };
}

let state = blankState();

// ---------- 링크 공유용 압축 인코딩 (서버 없이 URL 안에 데이터 저장) ----------
function encode(s) {
  const idx = Object.fromEntries(s.people.map((p, i) => [p.id, i]));
  const compact = {
    t: s.title,
    u: s.unit,
    a: s.account,
    tr: idx[s.treasurer] ?? -1,
    p: s.people.map((p) => [p.name, p.weight, p.drinks ? 1 : 0, p.fixed ?? -1]),
    r: s.rounds.map((r) => {
      const att = r.attendees.filter((id) => idx[id] >= 0);
      const g = att.map((id) => (r.glasses || {})[id] || 0);
      const row = [r.name, r.food, r.alcohol, idx[r.payer] ?? -1, att.map((id) => idx[id])];
      return g.some((x) => x > 0) ? [...row, g] : row;
    }),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const c = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
  const people = c.p.map(([name, weight, drinks, fixed], i) => ({
    id: `p${i}`,
    name: String(name),
    weight: Number(weight) || 1,
    drinks: !!drinks,
    fixed: fixed >= 0 ? Number(fixed) : null,
  }));
  const pid = (i) => (i >= 0 && people[i] ? people[i].id : null);
  return {
    title: c.t || '',
    unit: Number(c.u) || 1,
    account: c.a || '',
    treasurer: pid(c.tr),
    people,
    rounds: c.r.map(([name, food, alcohol, payer, att, g = []], i) => {
      const glasses = {};
      att.forEach((pi, k) => pid(pi) && g[k] > 0 && (glasses[pid(pi)] = Number(g[k])));
      return {
        id: `r${i}`,
        name: String(name),
        food: Number(food) || 0,
        alcohol: Number(alcohol) || 0,
        payer: pid(payer),
        attendees: att.map(pid).filter(Boolean),
        glasses,
      };
    }),
  };
}

function shareUrl() {
  return `${location.origin}${location.pathname}#d=${encode(state)}`;
}

function save() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch (e) {}
}

// ---------- 입력 화면 ----------
function esc(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function parseAmount(v) {
  return parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0;
}

function bindAmount(input, onValue) {
  input.addEventListener('input', () => {
    const n = parseAmount(input.value);
    input.value = n ? won(n) : '';
    onValue(n);
  });
}

function renderPeople() {
  const list = $('people');
  if (state.people.length === 0) {
    list.innerHTML = '<li class="empty">아직 아무도 없어요. <button type="button" id="fillSample" class="text">예시로 채워보기</button></li>';
    $('fillSample').onclick = fillSample;
    return;
  }
  list.innerHTML = state.people
    .map(
      (p) => `
    <li data-id="${p.id}">
      <span class="name">${esc(p.name)}</span>
      <button type="button" class="chip drink ${p.drinks ? 'on' : ''}" title="술 마심">🍺</button>
      <select class="weight" aria-label="비율">
        ${WEIGHTS.map(([w, label]) => `<option value="${w}" ${w === p.weight ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <input class="fixed" type="text" inputmode="numeric" placeholder="고정" value="${p.fixed != null ? won(p.fixed) : ''}" aria-label="고정 금액">
      <button type="button" class="remove" aria-label="삭제">✕</button>
    </li>`
    )
    .join('');
  list.querySelectorAll('li[data-id]').forEach((li) => {
    const p = state.people.find((x) => x.id === li.dataset.id);
    li.querySelector('.drink').onclick = (e) => {
      p.drinks = !p.drinks;
      e.currentTarget.classList.toggle('on', p.drinks);
      renderRounds();
      update();
    };
    li.querySelector('.weight').onchange = (e) => {
      p.weight = Number(e.target.value);
      update();
    };
    const fixed = li.querySelector('.fixed');
    bindAmount(fixed, (n) => {
      p.fixed = fixed.value === '' ? null : n;
      update();
    });
    li.querySelector('.remove').onclick = () => {
      state.people = state.people.filter((x) => x !== p);
      state.rounds.forEach((r) => {
        r.attendees = r.attendees.filter((id) => id !== p.id);
        if (r.payer === p.id) r.payer = null;
      });
      if (state.treasurer === p.id) state.treasurer = null;
      renderAll();
    };
  });
}

function renderRounds() {
  const box = $('rounds');
  const payerOptions = (sel) =>
    `<option value="">총무가 결제</option>` +
    state.people.map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  box.innerHTML = state.rounds
    .map(
      (r, i) => `
    <div class="round" data-id="${r.id}">
      <div class="round-head">
        <input class="rname" type="text" maxlength="10" value="${esc(r.name)}" aria-label="차수 이름">
        ${state.rounds.length > 1 ? `<button type="button" class="remove" aria-label="삭제">✕</button>` : ''}
      </div>
      <div class="grid2">
        <label>🍖 음식·안주·기타
          <input class="food" type="text" inputmode="numeric" placeholder="0" value="${r.food ? won(r.food) : ''}">
        </label>
        <label>🍺 술값 (마신 사람만)
          <input class="alcohol" type="text" inputmode="numeric" placeholder="0" value="${r.alcohol ? won(r.alcohol) : ''}">
        </label>
      </div>
      <label>결제한 사람
        <select class="payer">${payerOptions(r.payer)}</select>
      </label>
      <div class="attendees-label">
        <span>참석자 (${r.attendees.length}/${state.people.length})</span>
        ${state.people.length ? `<button type="button" class="text all">${r.attendees.length === state.people.length ? '전체 해제' : '전체 선택'}</button>` : ''}
      </div>
      <div class="chips">
        ${state.people.length ? state.people.map((p) => `<button type="button" class="chip att ${r.attendees.includes(p.id) ? 'on' : ''}" data-pid="${p.id}">${esc(p.name)}</button>`).join('') : '<span class="hint">먼저 사람을 추가하세요</span>'}
      </div>
      ${glassBox(r)}
    </div>`
    )
    .join('');
  box.querySelectorAll('.round').forEach((el) => {
    const r = state.rounds.find((x) => x.id === el.dataset.id);
    el.querySelector('.rname').oninput = (e) => {
      r.name = e.target.value || '차수';
      update();
    };
    bindAmount(el.querySelector('.food'), (n) => ((r.food = n), update()));
    bindAmount(el.querySelector('.alcohol'), (n) => ((r.alcohol = n), update()));
    el.querySelector('.payer').onchange = (e) => {
      r.payer = e.target.value || null;
      update();
    };
    const rm = el.querySelector('.remove');
    if (rm) rm.onclick = () => ((state.rounds = state.rounds.filter((x) => x !== r)), renderAll());
    const all = el.querySelector('.all');
    if (all) {
      all.onclick = () => {
        r.attendees = r.attendees.length === state.people.length ? [] : state.people.map((p) => p.id);
        renderAll();
      };
    }
    el.querySelectorAll('.glass-row').forEach((row) => {
      const id = row.dataset.pid;
      const change = (d) => {
        r.glasses = r.glasses || {};
        r.glasses[id] = Math.max(0, (r.glasses[id] || 0) + d);
        row.querySelector('.count').textContent = r.glasses[id];
        const total = Object.entries(r.glasses).reduce((s, [pid, n]) => s + (r.attendees.includes(pid) ? n : 0), 0);
        el.querySelector('.gtotal').textContent = total ? `총 ${total}잔` : '';
        update();
      };
      row.querySelector('.minus').onclick = () => change(-1);
      row.querySelector('.plus').onclick = () => change(1);
    });
    el.querySelectorAll('.att').forEach((chip) => {
      chip.onclick = () => {
        const id = chip.dataset.pid;
        r.attendees = r.attendees.includes(id) ? r.attendees.filter((x) => x !== id) : [...r.attendees, id];
        renderAll();
      };
    });
  });
}

function glassBox(r) {
  const drinkers = state.people.filter((p) => p.drinks && r.attendees.includes(p.id));
  if (!drinkers.length) return '';
  const g = r.glasses || {};
  const total = drinkers.reduce((s, p) => s + (g[p.id] || 0), 0);
  return `
    <div class="glasses">
      <div class="attendees-label">
        <span>🍺 몇 잔 마셨나요? <b class="gtotal">${total ? `총 ${total}잔` : ''}</b></span>
      </div>
      <p class="hint">입력하면 술값을 마신 잔 수대로 나눠요. 비워두면 비율대로 나눠요.</p>
      ${drinkers
        .map(
          (p) => `<div class="glass-row" data-pid="${p.id}">
            <span>${esc(p.name)}</span>
            <button type="button" class="step-btn minus" aria-label="한 잔 빼기">−</button>
            <b class="count">${g[p.id] || 0}</b>
            <button type="button" class="step-btn plus" aria-label="한 잔 추가">+</button>
          </div>`
        )
        .join('')}
    </div>`;
}

function renderSettings() {
  $('title').value = state.title;
  $('unit').value = String(state.unit);
  $('account').value = state.account;
  $('treasurer').innerHTML =
    `<option value="">1차 결제자 (자동)</option>` +
    state.people.map((p) => `<option value="${p.id}" ${p.id === state.treasurer ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}

// ---------- 결과 ----------
let lastResult = null;

function renderResult() {
  const body = $('resultBody');
  const res = calculate(state);
  lastResult = res;
  if (state.people.length === 0 || res.total === 0) {
    body.innerHTML = '<p class="hint">사람과 금액을 입력하면 여기에 바로 계산돼요.</p>';
    return;
  }
  const byId = Object.fromEntries(state.people.map((p) => [p.id, p]));
  const name = (id) => esc(byId[id] ? byId[id].name : '?');
  const tags = (p) =>
    [
      p.id === res.treasurer && '<span class="tag boss">총무</span>',
      !p.drinks && '<span class="tag">술X</span>',
      p.fixed != null && '<span class="tag">고정</span>',
      p.weight !== 1 && `<span class="tag">${p.weight}배</span>`,
    ]
      .filter(Boolean)
      .join('');

  const king = topDrinker(res);
  body.innerHTML = `
    ${res.totalGlasses ? `<div class="drink-stats">🍺 오늘 총 <strong>${res.totalGlasses}잔</strong>${king ? ` · <span class="nowrap">👑 오늘의 주당 <strong>${esc(king.name)}</strong> (${king.glasses}잔)</span>` : ''}</div>` : ''}
    <div class="total">총 <strong>${won(res.total)}원</strong>
      <span>${res.rounds.filter((r) => r.total).map((r) => `${esc(r.name)} ${won(r.total)}`).join(' · ')}</span>
    </div>
    ${res.warnings.map((w) => `<p class="warn">⚠️ ${esc(w)}</p>`).join('')}
    <ul class="shares">
      ${res.people
        .map((rp) => {
          const p = byId[rp.id];
          const detail = res.rounds
            .map((r, i) => (rp.rounds[i] ? `${esc(r.name)} ${won(rp.rounds[i])}` : ''))
            .filter(Boolean)
            .join(' · ');
          const isKing = king && king.id === rp.id;
          return `<li>
            <div><span class="name">${isKing ? '👑 ' : ''}${esc(p.name)}</span>${tags(p)}<div class="detail">${detail || '참석 안 함'}${rp.glasses ? ` · <span class="nowrap">🍺 ${rp.glasses}잔</span>` : ''}</div></div>
            <strong>${won(rp.share)}원</strong>
          </li>`;
        })
        .join('')}
    </ul>
    ${
      res.transfers.length
        ? `<h3>송금 목록</h3><ul class="transfers">${res.transfers
            .map((t) => `<li><span>${name(t.from)} → ${name(t.to)}</span><strong>${won(t.amount)}원</strong></li>`)
            .join('')}</ul>`
        : ''
    }
    ${state.account ? `<p class="account">💳 ${esc(state.account)}</p>` : ''}
  `;
}

// 가장 많이 마신 사람 (공동 1등이면 없음)
function topDrinker(res) {
  const sorted = res.people.filter((p) => p.glasses > 0).sort((a, b) => b.glasses - a.glasses);
  if (!sorted.length || (sorted[1] && sorted[1].glasses === sorted[0].glasses)) return null;
  return sorted[0];
}

function shareText() {
  const res = lastResult || calculate(state);
  const byId = Object.fromEntries(state.people.map((p) => [p.id, p]));
  const lines = [`[엔빵] ${state.title || '정산'} 결과`, `총 ${won(res.total)}원`];
  const king = topDrinker(res);
  if (res.totalGlasses) lines.push(`🍺 총 ${res.totalGlasses}잔${king ? ` · 👑 오늘의 주당 ${king.name} (${king.glasses}잔)` : ''}`);
  lines.push('');
  res.people.forEach((p) =>
    lines.push(`${p.name} ${won(p.share)}원${p.glasses ? ` (${p.glasses}잔)` : ''}${p.id === res.treasurer ? ' (총무)' : ''}`)
  );
  if (res.transfers.length) {
    lines.push('', '💸 송금');
    res.transfers.forEach((t) => lines.push(`${byId[t.from].name} → ${byId[t.to].name} ${won(t.amount)}원`));
  }
  if (state.account) lines.push('', `💳 ${state.account}`);
  if (!PREVIEW) lines.push('', `👉 자세히 보기: ${shareUrl()}`);
  return lines.join('\n');
}

// ---------- 공유 ----------
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2000);
}

async function copy(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(msg);
}

function loadKakao() {
  if (!KAKAO_JS_KEY || window.Kakao) return;
  const s = document.createElement('script');
  s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
  s.onload = () => window.Kakao.init(KAKAO_JS_KEY);
  document.head.appendChild(s);
}

async function share() {
  if (!lastResult || lastResult.total === 0) return toast('먼저 금액을 입력하세요');
  const url = shareUrl();
  history.replaceState(null, '', url);
  if (window.Kakao && window.Kakao.isInitialized()) {
    const res = lastResult;
    const summary = res.people.map((p) => `${p.name} ${won(p.share)}`).join(', ');
    window.Kakao.Share.sendDefault({
      objectType: 'text',
      text: `[엔빵] ${state.title || '정산'} 총 ${won(res.total)}원\n${summary}`.slice(0, 200),
      link: { mobileWebUrl: url, webUrl: url },
      buttonTitle: '내 금액 확인하기',
    });
    return;
  }
  if (navigator.share && !PREVIEW) {
    try {
      await navigator.share({ title: `엔빵 - ${state.title || '정산'}`, text: shareText() });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  copy(shareText(), '결과가 복사됐어요. 카톡방에 붙여넣으세요!');
}

// ---------- 공통 ----------
function update() {
  // 공유 링크를 열어 수정하기 시작하면 내 초안으로 전환
  if (location.hash) history.replaceState(null, '', location.pathname);
  save();
  renderResult();
}

function renderAll() {
  renderPeople();
  renderRounds();
  renderSettings();
  update();
}

function addPerson(name) {
  const p = { id: uid('p'), name, weight: 1, drinks: true, fixed: null };
  state.people.push(p);
  // 새로 온 사람은 기본적으로 1차에 참석한 것으로
  if (state.rounds[0]) state.rounds[0].attendees.push(p.id);
  return p;
}

function fillSample() {
  state = blankState();
  state.title = '팀 회식';
  const [a, b, c, d] = ['김부장', '박선배', '이대리', '최막내'].map(addPerson);
  a.weight = 2;
  b.weight = 1.5;
  c.drinks = false;
  d.weight = 0.8;
  Object.assign(state.rounds[0], { food: 128000, alcohol: 52000, payer: b.id, glasses: { [a.id]: 9, [b.id]: 6, [d.id]: 4 } });
  state.rounds.push({ ...newRound(2, [b.id, d.id]), name: '2차 노래방', food: 40000 });
  state.treasurer = b.id;
  renderAll();
}

function setSharedMode(on) {
  $('sharedBanner').classList.toggle('hidden', !on);
  $('editor').classList.toggle('hidden', on);
  if (on) $('sharedTitle').textContent = `📌 ${state.title || '정산'} · 총 ${won(calculate(state).total)}원`;
}

function init() {
  const m = location.hash.match(/^#d=(.+)$/);
  let shared = false;
  if (m) {
    try {
      state = decode(m[1]);
      shared = true;
    } catch (e) {
      toast('링크가 손상되어 열 수 없어요');
    }
  }
  if (!shared) {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (draft && Array.isArray(draft.people) && Array.isArray(draft.rounds)) state = draft;
    } catch (e) {}
  }

  $('addPersonForm').onsubmit = (e) => {
    e.preventDefault();
    const input = $('personName');
    const names = input.value.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    names.forEach(addPerson);
    input.value = '';
    renderAll();
    input.focus();
  };
  $('addRound').onclick = () => {
    const prev = state.rounds[state.rounds.length - 1];
    state.rounds.push(newRound(state.rounds.length + 1, prev ? [...prev.attendees] : []));
    renderAll();
  };
  $('title').oninput = (e) => ((state.title = e.target.value), update());
  $('unit').onchange = (e) => ((state.unit = Number(e.target.value)), update());
  $('account').oninput = (e) => ((state.account = e.target.value), update());
  $('treasurer').onchange = (e) => ((state.treasurer = e.target.value || null), update());
  $('shareBtn').onclick = share;
  $('copyText').onclick = () => copy(shareText(), '결과 텍스트를 복사했어요');
  $('copyLink').onclick = () => copy(shareUrl(), '링크를 복사했어요');
  // 실수로 지우지 않도록 두 번 눌러야 초기화
  $('resetBtn').onclick = (e) => {
    const btn = e.currentTarget;
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.textContent = '한 번 더 누르면 모두 지워져요';
      setTimeout(() => {
        delete btn.dataset.armed;
        btn.textContent = '처음부터 다시';
      }, 3000);
      return;
    }
    delete btn.dataset.armed;
    btn.textContent = '처음부터 다시';
    state = blankState();
    history.replaceState(null, '', location.pathname);
    setSharedMode(false);
    renderAll();
  };
  $('editShared').onclick = () => setSharedMode(false);
  $('newCalc').onclick = () => {
    state = blankState();
    history.replaceState(null, '', location.pathname);
    setSharedMode(false);
    renderAll();
    window.scrollTo(0, 0);
  };

  if (PREVIEW) $('copyLink').hidden = true;
  renderPeople();
  renderRounds();
  renderSettings();
  renderResult();
  if (shared) setSharedMode(true);
  // 미리보기에서는 처음 들어오면 예시로 채워서 바로 보여줌
  else if (PREVIEW && state.people.length === 0) fillSample();
  loadKakao();
}

init();
