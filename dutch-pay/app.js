// 카카오 디벨로퍼스(https://developers.kakao.com)에서 발급받은 JavaScript 키.
// 넣으면 카톡 공유 버튼이 사이트 링크를 카드 형태로 보냅니다.
// 비워두면 휴대폰 기본 공유창(→ 카카오톡 선택)으로 링크를 보내고, 그것도 안 되면 링크를 복사합니다.
const KAKAO_JS_KEY = '';
// Firebase Realtime Database 주소 (예: https://nbbang-xxxx-default-rtdb.firebaseio.com).
// 넣으면 '보냈어요' 체크가 링크를 연 모든 사람에게 실시간으로 공유됩니다. 비워두면 내 기기에만 저장돼요.
const FIREBASE_DB_URL = window.NBBANG_FIREBASE_URL || '';
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
const DRINK_PRESETS = [
  ['소주', 5000],
  ['맥주', 5000],
  ['생맥주', 4500],
  ['하이볼', 8000],
  ['막걸리', 5000],
  ['와인', 30000],
];
// 송금 링크는 공유 링크로 누구나 넣을 수 있으므로 토스·카카오페이 공식 주소만 허용
const PAY_HOSTS = { 'toss.me': '토스', 'qr.kakaopay.com': '카카오페이' };

let seq = 0;
const uid = (p) => `${p}${Date.now().toString(36)}${seq++}`;
const billId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function blankState() {
  return {
    billId: billId(),
    title: '',
    unit: 100,
    treasurer: null,
    account: '',
    payLink: '',
    oddMode: 'treasurer',
    oddPayer: null,
    people: [],
    rounds: [newRound(1, [])],
  };
}

function newRound(n, attendees) {
  return { id: uid('r'), name: `${n}차`, food: 0, alcohol: 0, payer: null, attendees, glasses: {}, drinks: [] };
}

let state = blankState();
let shared = false;

function calcState() {
  return { ...state, oddPayer: state.oddMode === 'roulette' ? state.oddPayer : null };
}

// ---------- 링크 공유용 압축 인코딩 (서버 없이 URL 안에 데이터 저장) ----------
function encode(s) {
  const idx = Object.fromEntries(s.people.map((p, i) => [p.id, i]));
  const compact = {
    b: s.billId,
    t: s.title,
    u: s.unit,
    a: s.account,
    l: s.payLink,
    om: s.oddMode === 'roulette' ? 1 : 0,
    op: idx[s.oddPayer] ?? -1,
    tr: idx[s.treasurer] ?? -1,
    p: s.people.map((p) => [p.name, p.weight, p.drinks ? 1 : 0, p.fixed ?? -1]),
    r: s.rounds.map((r) => {
      const att = r.attendees.filter((id) => idx[id] >= 0);
      const counts = (obj) => {
        const g = att.map((id) => (obj || {})[id] || 0);
        return g.some((x) => x > 0) ? g : 0;
      };
      const row = [r.name, r.food, r.alcohol, idx[r.payer] ?? -1, att.map((id) => idx[id]), counts(r.glasses)];
      const drinks = (r.drinks || []).map((d) => [d.name, d.price, d.qty, counts(d.glasses)]);
      return drinks.length ? [...row, drinks] : row;
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
    billId: String(c.b || billId()),
    title: c.t || '',
    unit: Number(c.u) || 1,
    account: c.a || '',
    payLink: safePayLink(c.l || '') ? c.l : '',
    oddMode: c.om ? 'roulette' : 'treasurer',
    oddPayer: pid(c.op ?? -1),
    treasurer: pid(c.tr),
    people,
    rounds: c.r.map(([name, food, alcohol, payer, att, g, drinks = []], i) => {
      const counts = (arr) => {
        const out = {};
        (arr || []).forEach((n, k) => pid(att[k]) && n > 0 && (out[pid(att[k])] = Number(n)));
        return out;
      };
      return {
        id: `r${i}`,
        name: String(name),
        food: Number(food) || 0,
        alcohol: Number(alcohol) || 0,
        payer: pid(payer),
        attendees: att.map(pid).filter(Boolean),
        glasses: counts(g),
        drinks: drinks.map(([dn, price, qty, dg], k) => ({
          id: `d${i}_${k}`,
          name: String(dn),
          price: Number(price) || 0,
          qty: Number(qty) || 0,
          glasses: counts(dg),
        })),
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

// 예전 버전 초안에 새 필드 채우기
function normalize(s) {
  const base = blankState();
  const out = { ...base, ...s };
  out.rounds = (s.rounds || []).map((r) => ({ glasses: {}, drinks: [], ...r }));
  if (!out.rounds.length) out.rounds = base.rounds;
  return out;
}

function safePayLink(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && PAY_HOSTS[u.hostname] ? PAY_HOSTS[u.hostname] : null;
  } catch (e) {
    return null;
  }
}

// ---------- 송금 완료 체크 (Firebase가 있으면 모두에게 공유, 없으면 내 기기에만) ----------
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 'k' + h.toString(16);
}

const paid = {
  data: {},
  key: (t) => hash(`${nameOf(t.from)}>${nameOf(t.to)}>${t.amount}`),
  local: () => `nbbang:paid:${state.billId}`,
  remote: (path = '') => `${FIREBASE_DB_URL.replace(/\/$/, '')}/bills/${encodeURIComponent(state.billId)}/paid${path}.json`,
  load() {
    try {
      this.data = JSON.parse(localStorage.getItem(this.local())) || {};
    } catch (e) {
      this.data = {};
    }
  },
  store() {
    try {
      localStorage.setItem(this.local(), JSON.stringify(this.data));
    } catch (e) {}
  },
  async pull() {
    if (!FIREBASE_DB_URL) return;
    try {
      const res = await fetch(this.remote());
      if (!res.ok) return;
      const next = (await res.json()) || {};
      if (JSON.stringify(next) !== JSON.stringify(this.data)) {
        this.data = next;
        this.store();
        renderResult();
      }
    } catch (e) {}
  },
  async set(t, on) {
    const k = this.key(t);
    if (on) this.data[k] = true;
    else delete this.data[k];
    this.store();
    renderResult();
    if (!FIREBASE_DB_URL) return;
    try {
      const res = await fetch(this.remote(`/${k}`), on ? { method: 'PUT', body: 'true' } : { method: 'DELETE' });
      if (!res.ok) throw new Error(res.status);
    } catch (e) {
      toast('체크를 저장하지 못했어요. 인터넷 연결을 확인하세요');
    }
  },
};

// ---------- 입력 화면 ----------
function esc(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function nameOf(id) {
  const p = state.people.find((x) => x.id === id);
  return p ? p.name : '?';
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
      if (state.oddPayer === p.id) state.oddPayer = null;
      renderAll();
    };
  });
}

function stepRows(target, drinkers, counts) {
  return drinkers
    .map(
      (p) => `<div class="glass-row" data-target="${target}" data-pid="${p.id}">
        <span>${esc(p.name)}</span>
        <button type="button" class="step-btn minus" aria-label="${esc(p.name)} 한 잔 빼기">−</button>
        <b class="count">${(counts || {})[p.id] || 0}</b>
        <button type="button" class="step-btn plus" aria-label="${esc(p.name)} 한 잔 추가">+</button>
      </div>`
    )
    .join('');
}

function drinkersOf(r) {
  return state.people.filter((p) => p.drinks && r.attendees.includes(p.id));
}

function sumCounts(r, counts) {
  return r.attendees.reduce((s, id) => s + ((counts || {})[id] || 0), 0);
}

function lumpBox(r) {
  const drinkers = drinkersOf(r);
  if (!drinkers.length) return '';
  const total = sumCounts(r, r.glasses);
  return `
    <div class="glasses lump ${r.alcohol ? '' : 'hidden'}">
      <div class="attendees-label"><span>🍺 술값 합계를 몇 잔씩 마셨나요? <b class="gtotal">${total ? `총 ${total}잔` : ''}</b></span></div>
      <p class="hint">입력하면 술값을 마신 잔 수대로 나눠요. 비워두면 비율대로 나눠요.</p>
      ${stepRows('lump', drinkers, r.glasses)}
    </div>`;
}

function drinkItem(r, d) {
  const drinkers = drinkersOf(r);
  const total = sumCounts(r, d.glasses);
  return `
    <div class="drink-item" data-did="${d.id}">
      <div class="drink-head">
        <input class="dname" type="text" maxlength="10" value="${esc(d.name)}" aria-label="술 이름">
        <input class="dprice" type="text" inputmode="numeric" value="${d.price ? won(d.price) : ''}" placeholder="단가" aria-label="${esc(d.name)} 단가">
        <span class="qty">
          <button type="button" class="step-btn qminus" aria-label="수량 빼기">−</button>
          <b class="qcount">${d.qty}</b>
          <button type="button" class="step-btn qplus" aria-label="수량 추가">+</button>
        </span>
        <button type="button" class="remove dremove" aria-label="${esc(d.name)} 삭제">✕</button>
      </div>
      <p class="hint dcost">${d.qty}병·잔 × ${won(d.price || 0)}원 = <b>${won((d.price || 0) * d.qty)}원</b>${drinkers.length ? ' · 마신 사람 잔 수를 세면 그만큼만 내요' : ''}</p>
      ${drinkers.length ? `<div class="glass-sub"><span class="gtotal">${total ? `${esc(d.name)} 총 ${total}잔` : ''}</span>${stepRows(d.id, drinkers, d.glasses)}</div>` : ''}
    </div>`;
}

function renderRounds() {
  const box = $('rounds');
  const payerOptions = (sel) =>
    `<option value="">총무가 결제</option>` +
    state.people.map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  box.innerHTML = state.rounds
    .map(
      (r) => `
    <div class="round" data-id="${r.id}">
      <div class="round-head">
        <input class="rname" type="text" maxlength="10" value="${esc(r.name)}" aria-label="차수 이름">
        ${state.rounds.length > 1 ? `<button type="button" class="remove rremove" aria-label="차수 삭제">✕</button>` : ''}
      </div>
      <div class="grid2">
        <label>🍖 음식·안주·기타
          <input class="food" type="text" inputmode="numeric" placeholder="0" value="${r.food ? won(r.food) : ''}">
        </label>
        <label>🍺 술값 합계 (마신 사람만)
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
      ${lumpBox(r)}
      <div class="drinks-box">
        <div class="attendees-label"><span>🍶 술 종류별로 입력 (선택)</span></div>
        <p class="hint">소주는 소주 마신 사람끼리, 맥주는 맥주 마신 사람끼리 나눠요.</p>
        <div class="chips presets">
          ${DRINK_PRESETS.map(([n, price]) => `<button type="button" class="chip preset" data-name="${n}" data-price="${price}">+ ${n}</button>`).join('')}
        </div>
        ${(r.drinks || []).map((d) => drinkItem(r, d)).join('')}
      </div>
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
    bindAmount(el.querySelector('.alcohol'), (n) => {
      r.alcohol = n;
      const lump = el.querySelector('.lump');
      if (lump) lump.classList.toggle('hidden', !n);
      update();
    });
    el.querySelector('.payer').onchange = (e) => {
      r.payer = e.target.value || null;
      update();
    };
    const rm = el.querySelector('.rremove');
    if (rm) rm.onclick = () => ((state.rounds = state.rounds.filter((x) => x !== r)), renderAll());
    const all = el.querySelector('.all');
    if (all) {
      all.onclick = () => {
        r.attendees = r.attendees.length === state.people.length ? [] : state.people.map((p) => p.id);
        renderAll();
      };
    }
    el.querySelectorAll('.att').forEach((chip) => {
      chip.onclick = () => {
        const id = chip.dataset.pid;
        r.attendees = r.attendees.includes(id) ? r.attendees.filter((x) => x !== id) : [...r.attendees, id];
        renderAll();
      };
    });
    el.querySelectorAll('.preset').forEach((btn) => {
      btn.onclick = () => {
        r.drinks = r.drinks || [];
        r.drinks.push({ id: uid('d'), name: btn.dataset.name, price: Number(btn.dataset.price), qty: 1, glasses: {} });
        renderRounds();
        update();
      };
    });
    el.querySelectorAll('.drink-item').forEach((item) => {
      const d = r.drinks.find((x) => x.id === item.dataset.did);
      const refreshCost = () => {
        item.querySelector('.qcount').textContent = d.qty;
        item.querySelector('.dcost b').textContent = `${won((d.price || 0) * d.qty)}원`;
        item.querySelector('.dcost').firstChild.textContent = `${d.qty}병·잔 × ${won(d.price || 0)}원 = `;
        update();
      };
      item.querySelector('.dname').oninput = (e) => ((d.name = e.target.value || '술'), update());
      bindAmount(item.querySelector('.dprice'), (n) => ((d.price = n), refreshCost()));
      item.querySelector('.qminus').onclick = () => ((d.qty = Math.max(0, d.qty - 1)), refreshCost());
      item.querySelector('.qplus').onclick = () => ((d.qty += 1), refreshCost());
      item.querySelector('.dremove').onclick = () => {
        r.drinks = r.drinks.filter((x) => x !== d);
        renderRounds();
        update();
      };
    });
    el.querySelectorAll('.glass-row').forEach((row) => {
      const id = row.dataset.pid;
      const target = row.dataset.target;
      const change = (delta) => {
        const owner = target === 'lump' ? r : r.drinks.find((x) => x.id === target);
        owner.glasses = owner.glasses || {};
        owner.glasses[id] = Math.max(0, (owner.glasses[id] || 0) + delta);
        row.querySelector('.count').textContent = owner.glasses[id];
        const total = sumCounts(r, owner.glasses);
        const label = row.parentElement.querySelector('.gtotal');
        if (label) label.textContent = total ? `${target === 'lump' ? '' : `${owner.name} `}총 ${total}잔` : '';
        update();
      };
      row.querySelector('.minus').onclick = () => change(-1);
      row.querySelector('.plus').onclick = () => change(1);
    });
  });
}

function renderSettings() {
  $('title').value = state.title;
  $('unit').value = String(state.unit);
  $('account').value = state.account;
  $('payLink').value = state.payLink;
  $('oddMode').value = state.oddMode;
  $('treasurer').innerHTML =
    `<option value="">1차 결제자 (자동)</option>` +
    state.people.map((p) => `<option value="${p.id}" ${p.id === state.treasurer ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}

// ---------- 결과 ----------
let lastResult = null;

// 가장 많이 마신 사람 (공동 1등이면 없음)
function topDrinker(res) {
  const sorted = res.people.filter((p) => p.glasses > 0).sort((a, b) => b.glasses - a.glasses);
  if (!sorted.length || (sorted[1] && sorted[1].glasses === sorted[0].glasses)) return null;
  return sorted[0];
}

function drinkSummary(res) {
  return res.drinks.map((d) => `${d.name} ${d.qty}`).join(' · ');
}

function payButtons(t, res) {
  if (t.to !== res.treasurer) return '';
  const app = safePayLink(state.payLink);
  return [
    state.account && `<button type="button" class="mini copy-acc" data-amount="${t.amount}">계좌·금액 복사</button>`,
    app && `<a class="mini pay" href="${esc(state.payLink)}" target="_blank" rel="noopener noreferrer">${app}로 보내기</a>`,
  ]
    .filter(Boolean)
    .join('');
}

function transferRow(t, res) {
  const done = !!paid.data[paid.key(t)];
  return `<li class="${done ? 'done' : ''}" data-key="${paid.key(t)}">
    <div class="t-main">
      <span>${esc(nameOf(t.from))} → ${esc(nameOf(t.to))}</span>
      <strong>${won(t.amount)}원</strong>
    </div>
    <div class="t-actions">
      ${payButtons(t, res)}
      <button type="button" class="mini check ${done ? 'on' : ''}" aria-pressed="${done}">${done ? '✓ 보냈어요' : '보냈어요'}</button>
    </div>
  </li>`;
}

function bindTransfers(root, res) {
  root.querySelectorAll('[data-key]').forEach((li) => {
    const t = res.transfers.find((x) => paid.key(x) === li.dataset.key);
    li.querySelector('.check').onclick = () => {
      const on = !paid.data[paid.key(t)];
      paid.set(t, on);
      if (on) toast(`${nameOf(t.from)} 송금 완료로 표시했어요`);
    };
    const acc = li.querySelector('.copy-acc');
    if (acc) acc.onclick = () => copy(`${state.account} ${won(t.amount)}원`, '계좌번호와 금액을 복사했어요');
  });
}

function renderResult() {
  const body = $('resultBody');
  const res = calculate(calcState());
  lastResult = res;
  $('cardBtn').disabled = res.total === 0;
  if (state.people.length === 0 || res.total === 0) {
    body.innerHTML = '<p class="hint">사람과 금액을 입력하면 여기에 바로 계산돼요.</p>';
    renderMe(res);
    return;
  }
  const byId = Object.fromEntries(state.people.map((p) => [p.id, p]));
  const tags = (p) =>
    [
      p.id === res.treasurer && '<span class="tag boss">총무</span>',
      !p.drinks && '<span class="tag">술X</span>',
      p.fixed != null && '<span class="tag">고정</span>',
      p.weight !== 1 && `<span class="tag">${p.weight}배</span>`,
      res.odd && res.odd.payer === p.id && res.odd.amount > 0 && `<span class="tag odd">끝전 +${won(res.odd.amount)}</span>`,
    ]
      .filter(Boolean)
      .join('');

  const king = topDrinker(res);
  const done = res.transfers.filter((t) => paid.data[paid.key(t)]).length;
  const canSpin = state.oddMode === 'roulette' && state.unit > 1 && !shared;
  body.innerHTML = `
    ${
      res.totalGlasses || res.drinks.length
        ? `<div class="drink-stats">
            ${res.totalGlasses ? `🍺 오늘 총 <strong>${res.totalGlasses}잔</strong>` : ''}
            ${king ? ` · <span class="nowrap">👑 오늘의 주당 <strong>${esc(king.name)}</strong> (${king.glasses}잔)</span>` : ''}
            ${res.drinks.length ? `<div class="drink-kinds">🍶 ${esc(drinkSummary(res))}</div>` : ''}
          </div>`
        : ''
    }
    <div class="total">총 <strong>${won(res.total)}원</strong>
      <span>${res.rounds.filter((r) => r.total).map((r) => `${esc(r.name)} ${won(r.total)}`).join(' · ')}</span>
    </div>
    ${res.warnings.map((w) => `<p class="warn">⚠️ ${esc(w)}</p>`).join('')}
    ${
      state.oddMode === 'roulette' && state.unit > 1
        ? `<div class="odd-box">
            ${
              res.odd
                ? `🎯 끝전 몰아주기 당첨: <strong>${esc(nameOf(res.odd.payer))}</strong> (+${won(res.odd.amount)}원)`
                : '🎯 끝전 몰아주기: 아직 안 돌렸어요'
            }
            ${canSpin ? `<button type="button" id="spinBtn" class="mini">${res.odd ? '다시 돌리기' : '룰렛 돌리기'}</button>` : ''}
          </div>`
        : ''
    }
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
        ? `<div class="transfer-head">
            <h3>송금 목록</h3>
            <span class="progress-label">${done === res.transfers.length ? '🎉 모두 보냈어요' : `${done}/${res.transfers.length}명 송금 완료`}</span>
          </div>
          <div class="progress"><span style="width:${(done / res.transfers.length) * 100}%"></span></div>
          <ul class="transfers">${res.transfers.map((t) => transferRow(t, res)).join('')}</ul>
          <p class="hint">${FIREBASE_DB_URL ? '보냈어요 체크는 링크를 연 모든 사람에게 보여요.' : '보냈어요 체크는 이 기기에 저장돼요.'}</p>`
        : ''
    }
    ${state.account ? `<p class="account">💳 ${esc(state.account)} <button type="button" class="mini" id="copyAccount">복사</button></p>` : ''}
  `;
  bindTransfers(body, res);
  const spin = $('spinBtn');
  if (spin) spin.onclick = spinRoulette;
  const ca = $('copyAccount');
  if (ca) ca.onclick = () => copy(state.account, '계좌번호를 복사했어요');
  renderMe(res);
}

// 공유 링크로 들어온 사람: 내 이름을 고르면 내가 할 일만 보여줌
function meKey() {
  return `nbbang:me:${state.billId}`;
}

function renderMe(res) {
  const box = $('mePicker');
  if (!shared || !res.total) {
    box.innerHTML = '';
    return;
  }
  let me = null;
  try {
    me = localStorage.getItem(meKey());
  } catch (e) {}
  const person = state.people.find((p) => p.name === me);
  const chips = state.people
    .map((p) => `<button type="button" class="chip me-chip ${person && p.id === person.id ? 'on' : ''}" data-name="${esc(p.name)}">${esc(p.name)}</button>`)
    .join('');
  let card = '';
  if (person) {
    const rp = res.people.find((p) => p.id === person.id);
    const mine = res.transfers.filter((t) => t.from === person.id);
    const incoming = res.transfers.filter((t) => t.to === person.id);
    card = `<div class="me-card">
      <div class="me-amount">${esc(person.name)}님 몫 <strong>${won(rp.share)}원</strong></div>
      ${mine.length ? `<ul class="transfers">${mine.map((t) => transferRow(t, res)).join('')}</ul>` : ''}
      ${!mine.length && incoming.length ? `<p>받을 돈 ${won(incoming.reduce((s, t) => s + t.amount, 0))}원 · 아래에서 누가 보냈는지 확인하세요</p>` : ''}
      ${!mine.length && !incoming.length ? '<p>보낼 돈이 없어요 👍</p>' : ''}
    </div>`;
  }
  box.innerHTML = `<p class="me-q">나는 누구?</p><div class="chips">${chips}</div>${card}`;
  box.querySelectorAll('.me-chip').forEach((c) => {
    c.onclick = () => {
      try {
        localStorage.setItem(meKey(), c.dataset.name);
      } catch (e) {}
      renderMe(res);
    };
  });
  bindTransfers(box, res);
}

// ---------- 끝전 룰렛 ----------
function spinRoulette() {
  const res = lastResult;
  const candidates = res.people.filter((p) => p.share > 0 && state.people.find((x) => x.id === p.id).fixed == null);
  if (candidates.length < 2) return toast('룰렛을 돌리려면 2명 이상 필요해요');
  const winner = candidates[Math.floor(Math.random() * candidates.length)];
  const overlay = $('roulette');
  const nameEl = $('rouletteName');
  overlay.hidden = false;
  $('rouletteDone').hidden = true;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finish = () => {
    nameEl.textContent = winner.name;
    nameEl.classList.add('win');
    state.oddPayer = winner.id;
    update();
    $('rouletteSub').textContent = `끝전 ${won(lastResult.odd ? lastResult.odd.amount : 0)}원 당첨! 🎉`;
    $('rouletteDone').hidden = false;
  };
  nameEl.classList.remove('win');
  $('rouletteSub').textContent = '끝전 몰아주기 룰렛';
  if (reduce) return finish();
  let i = 0;
  let delay = 50;
  const tick = () => {
    nameEl.textContent = candidates[i++ % candidates.length].name;
    delay *= 1.12;
    if (delay > 380 && candidates[(i - 1) % candidates.length] === winner) return finish();
    setTimeout(tick, delay);
  };
  tick();
}

// ---------- 결과 이미지 카드 ----------
function drawCard(res) {
  const W = 1080;
  const rows = res.people.length;
  const rowH = rows > 10 ? 76 : 96;
  const statsH = res.totalGlasses || res.drinks.length ? 110 : 0;
  const H = 470 + statsH + rows * rowH + 170;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d');
  const font = (w, s) => `${w} ${s}px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif`;

  c.fillStyle = '#fffbf3';
  c.fillRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, W, 420);
  g.addColorStop(0, '#fbbf24');
  g.addColorStop(0.6, '#f59e0b');
  g.addColorStop(1, '#ea580c');
  c.fillStyle = g;
  c.fillRect(0, 0, W, 420);

  c.fillStyle = '#fff';
  c.font = font(700, 40);
  c.fillText('🍻 엔빵 정산서', 80, 110);
  c.font = font(800, 72);
  c.fillText((state.title || '술자리 정산').slice(0, 14), 80, 210);
  c.font = font(500, 40);
  c.fillText(`${state.people.length}명 · ${res.rounds.filter((r) => r.total).map((r) => r.name).join(' → ')}`.slice(0, 34), 80, 280);
  c.font = font(800, 80);
  c.fillText(`총 ${won(res.total)}원`, 80, 380);

  let y = 470;
  if (statsH) {
    c.fillStyle = '#fef3c7';
    c.beginPath();
    if (c.roundRect) c.roundRect(60, y - 50, W - 120, 90, 24);
    else c.rect(60, y - 50, W - 120, 90);
    c.fill();
    c.fillStyle = '#92400e';
    c.font = font(700, 36);
    const king = topDrinker(res);
    const line = [res.totalGlasses && `🍺 ${res.totalGlasses}잔`, king && `👑 주당 ${king.name}`, res.drinks.length && `🍶 ${drinkSummary(res)}`]
      .filter(Boolean)
      .join('  ·  ');
    c.fillText(line.slice(0, 40), 90, y + 8);
    y += statsH;
  }

  const king = topDrinker(res);
  res.people.forEach((p, i) => {
    const cy = y + i * rowH;
    if (i) {
      c.fillStyle = '#eee3d3';
      c.fillRect(80, cy - rowH / 2 - 6, W - 160, 2);
    }
    c.fillStyle = '#1f1a14';
    c.font = font(700, rowH > 80 ? 44 : 36);
    c.textAlign = 'left';
    c.fillText(`${king && king.id === p.id ? '👑 ' : ''}${p.name}`.slice(0, 12), 80, cy + 14);
    if (p.glasses) {
      c.fillStyle = '#7c6f5f';
      c.font = font(500, 32);
      c.fillText(`${p.glasses}잔`, 420, cy + 12);
    }
    c.fillStyle = p.id === res.treasurer ? '#b45309' : '#1f1a14';
    c.font = font(800, rowH > 80 ? 48 : 38);
    c.textAlign = 'right';
    c.fillText(`${won(p.share)}원`, W - 80, cy + 16);
    c.textAlign = 'left';
  });

  const fy = H - 90;
  c.fillStyle = '#f3efe8';
  c.fillRect(0, fy - 60, W, 150);
  c.fillStyle = '#7c6f5f';
  c.font = font(600, 34);
  c.fillText(`총무 ${nameOf(res.treasurer)}${state.account ? ` · ${state.account}` : ''}`.slice(0, 40), 80, fy);
  c.font = font(500, 30);
  c.fillText(`술자리 N빵 계산기 엔빵${PREVIEW || location.protocol === 'file:' ? '' : ` · ${location.host}`}`, 80, fy + 50);
  return cv;
}

function openCard() {
  const res = lastResult;
  if (!res || !res.total) return toast('먼저 금액을 입력하세요');
  const cv = drawCard(res);
  const url = cv.toDataURL('image/png');
  $('cardImg').src = url;
  $('cardModal').hidden = false;
  const save = $('cardSave');
  save.href = url;
  save.download = `엔빵-${state.title || '정산'}.png`;
  save.hidden = PREVIEW;
  const shareBtn = $('cardShare');
  shareBtn.hidden = true;
  if (!PREVIEW && navigator.canShare) {
    cv.toBlob((blob) => {
      const file = new File([blob], `enbbang.png`, { type: 'image/png' });
      if (!navigator.canShare({ files: [file] })) return;
      shareBtn.hidden = false;
      shareBtn.onclick = async () => {
        try {
          await navigator.share({ files: [file], text: `내 금액 확인하고 '보냈어요' 눌러주세요 👉 ${shareUrl()}` });
        } catch (e) {}
      };
    });
  }
}

// ---------- 공유 ----------
function shareText() {
  const res = lastResult || calculate(calcState());
  const lines = [`[엔빵] ${state.title || '정산'} 결과`, `총 ${won(res.total)}원`];
  const king = topDrinker(res);
  if (res.totalGlasses) lines.push(`🍺 총 ${res.totalGlasses}잔${king ? ` · 👑 오늘의 주당 ${king.name} (${king.glasses}잔)` : ''}`);
  if (res.drinks.length) lines.push(`🍶 ${drinkSummary(res)}`);
  lines.push('');
  res.people.forEach((p) =>
    lines.push(`${p.name} ${won(p.share)}원${p.glasses ? ` (${p.glasses}잔)` : ''}${p.id === res.treasurer ? ' (총무)' : ''}`)
  );
  if (res.transfers.length) {
    lines.push('', '💸 송금');
    res.transfers.forEach((t) => lines.push(`${nameOf(t.from)} → ${nameOf(t.to)} ${won(t.amount)}원`));
  }
  if (state.account) lines.push('', `💳 ${state.account}`);
  if (!PREVIEW) lines.push('', `👉 송금 체크하기: ${shareUrl()}`);
  return lines.join('\n');
}

// 카톡방에는 금액 전체 대신 짧은 안내 + 사이트 링크를 보냄 → 각자 들어와서 내 금액 확인
function shareTeaser() {
  const res = lastResult;
  return `[엔빵] ${state.title || '술자리'} 정산 완료! 총 ${won(res.total)}원 · ${state.people.length}명\n내 금액 확인하고 '보냈어요' 눌러주세요 👇`;
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
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
  if (PREVIEW) return copy(shareText(), '미리보기에서는 링크 대신 결과 텍스트를 복사했어요');
  const url = shareUrl();
  const res = lastResult;
  if (window.Kakao && window.Kakao.isInitialized()) {
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `${state.title || '술자리'} 정산 · 총 ${won(res.total)}원`,
        description: `${state.people.length}명 · 내 금액 확인하고 송금 체크하기`,
        imageUrl: new URL('og-image.png', location.href).href,
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [{ title: '내 금액 확인하기', link: { mobileWebUrl: url, webUrl: url } }],
    });
    return;
  }
  if (navigator.share) {
    try {
      await navigator.share({ title: `엔빵 - ${state.title || '정산'}`, text: shareTeaser(), url });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  copy(`${shareTeaser()}\n${url}`, '링크를 복사했어요. 카톡방에 붙여넣으세요!');
}

// ---------- 공통 ----------
function update() {
  // 공유 링크를 열어 수정하기 시작하면 내 초안으로 전환
  if (location.hash && !shared) history.replaceState(null, '', location.pathname);
  if (!shared) save();
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
  Object.assign(state.rounds[0], {
    food: 128000,
    payer: b.id,
    drinks: [
      { id: uid('d'), name: '소주', price: 5000, qty: 6, glasses: { [a.id]: 12, [b.id]: 8, [d.id]: 4 } },
      { id: uid('d'), name: '맥주', price: 5000, qty: 4, glasses: { [b.id]: 2, [d.id]: 6 } },
    ],
  });
  state.rounds.push({ ...newRound(2, [b.id, d.id]), name: '2차 노래방', food: 40000 });
  state.treasurer = b.id;
  state.account = '카카오뱅크 3333-01-1234567 박선배';
  paid.load();
  renderAll();
}

function startFresh() {
  state = blankState();
  shared = false;
  history.replaceState(null, '', location.pathname);
  setSharedMode(false);
  paid.load();
  renderAll();
}

function setSharedMode(on) {
  $('sharedBanner').classList.toggle('hidden', !on);
  $('editor').classList.toggle('hidden', on);
  if (on) $('sharedTitle').textContent = `📌 ${state.title || '정산'} · 총 ${won(calculate(calcState()).total)}원`;
}

function init() {
  const m = location.hash.match(/^#d=(.+)$/);
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
      if (draft && Array.isArray(draft.people) && Array.isArray(draft.rounds)) state = normalize(draft);
    } catch (e) {}
  }
  paid.load();

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
  $('payLink').oninput = (e) => {
    state.payLink = e.target.value.trim();
    $('payLinkHint').textContent =
      state.payLink && !safePayLink(state.payLink) ? '⚠️ toss.me 또는 qr.kakaopay.com 링크만 쓸 수 있어요' : '';
    update();
  };
  $('oddMode').onchange = (e) => {
    state.oddMode = e.target.value;
    if (state.oddMode === 'roulette' && state.unit === 1) {
      state.unit = 1000;
      $('unit').value = '1000';
    }
    update();
  };
  $('treasurer').onchange = (e) => ((state.treasurer = e.target.value || null), update());
  $('shareBtn').onclick = share;
  $('cardBtn').onclick = openCard;
  $('cardClose').onclick = () => ($('cardModal').hidden = true);
  $('rouletteDone').onclick = () => ($('roulette').hidden = true);
  $('copyText').onclick = () => copy(shareText(), '결과 텍스트를 복사했어요');
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
    startFresh();
  };
  $('editShared').onclick = () => {
    // 받은 정산을 내 초안으로 가져와 수정 (송금 체크는 같은 정산으로 유지)
    shared = false;
    setSharedMode(false);
    renderAll();
  };
  $('newCalc').onclick = () => {
    startFresh();
    window.scrollTo(0, 0);
  };

  renderPeople();
  renderRounds();
  renderSettings();
  renderResult();
  if (shared) setSharedMode(true);
  // 미리보기에서는 처음 들어오면 예시로 채워서 바로 보여줌
  else if (PREVIEW && state.people.length === 0) fillSample();

  if (FIREBASE_DB_URL) {
    paid.pull();
    setInterval(() => document.visibilityState === 'visible' && paid.pull(), 10000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && paid.pull());
  }
  loadKakao();
}

init();
