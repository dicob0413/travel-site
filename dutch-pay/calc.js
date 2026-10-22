// 엔빵 계산 로직 (UI와 분리되어 있어 node에서도 테스트 가능)
(function (root) {
  // amount(정수 원)를 weights 비율로 나누되 합계가 정확히 amount가 되도록 정수로 분배 (최대 잔여 방식)
  function splitInt(amount, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    if (amount <= 0 || total <= 0) return weights.map(() => 0);
    const exact = weights.map((w) => (amount * w) / total);
    const base = exact.map(Math.floor);
    let rest = amount - base.reduce((a, b) => a + b, 0);
    const order = exact
      .map((v, i) => ({ i, frac: v - base[i] }))
      .sort((a, b) => b.frac - a.frac || a.i - b.i);
    for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) base[order[k].i]++;
    return base;
  }

  function roundTotal(r) {
    return (r.food || 0) + (r.alcohol || 0);
  }

  // state = { people:[{id,name,weight,drinks,fixed}], rounds:[{id,name,food,alcohol,payer,attendees}], unit, treasurer }
  function calculate(state) {
    const people = state.people || [];
    const rounds = state.rounds || [];
    const unit = Math.max(1, state.unit || 1);
    const ids = people.map((p) => p.id);
    const byId = Object.fromEntries(people.map((p) => [p.id, p]));
    const treasurer = byId[state.treasurer] ? state.treasurer : (rounds.find((r) => byId[r.payer]) || {}).payer || ids[0];

    // 1) 차수별 기본 분담 (음식은 참석자 전원, 술은 술 마신 참석자만, 각자 비율 반영)
    const perRound = rounds.map((r) => {
      const att = (r.attendees || []).filter((id) => byId[id]);
      const shares = Object.fromEntries(ids.map((id) => [id, 0]));
      if (att.length === 0) return { round: r, shares, attendees: att, warning: roundTotal(r) > 0 ? '참석자가 없어요' : null };
      const w = att.map((id) => byId[id].weight || 1);
      splitInt(r.food || 0, w).forEach((v, i) => (shares[att[i]] += v));
      let drinkers = att.filter((id) => byId[id].drinks !== false);
      let warning = null;
      if (drinkers.length === 0 && (r.alcohol || 0) > 0) {
        drinkers = att;
        warning = '술 마신 사람이 없어 술값을 전원이 나눴어요';
      }
      splitInt(r.alcohol || 0, drinkers.map((id) => byId[id].weight || 1)).forEach((v, i) => (shares[drinkers[i]] += v));
      return { round: r, shares, attendees: att, warning };
    });

    const total = rounds.reduce((s, r) => s + roundTotal(r), 0);
    const raw = Object.fromEntries(ids.map((id) => [id, perRound.reduce((s, pr) => s + pr.shares[id], 0)]));

    // 2) 고정 금액(예: 부장님 10만원)을 내는 사람 반영 → 나머지는 원래 비율대로 다시 분배
    const fixedIds = ids.filter((id) => Number.isFinite(byId[id].fixed) && byId[id].fixed >= 0);
    const share = { ...raw };
    const warnings = perRound.filter((pr) => pr.warning).map((pr) => `${pr.round.name}: ${pr.warning}`);
    if (fixedIds.length) {
      const fixedSum = fixedIds.reduce((s, id) => s + byId[id].fixed, 0);
      const others = ids.filter((id) => !fixedIds.includes(id) && raw[id] > 0);
      const remain = total - fixedSum;
      if (remain < 0 || (remain > 0 && others.length === 0)) {
        warnings.push('고정 금액 합계가 총액과 맞지 않아 고정 금액을 무시했어요');
      } else {
        fixedIds.forEach((id) => (share[id] = byId[id].fixed));
        ids.filter((id) => !fixedIds.includes(id)).forEach((id) => (share[id] = 0));
        splitInt(remain, others.map((id) => raw[id])).forEach((v, i) => (share[others[i]] = v));
      }
    }

    // 3) 송금하기 편하게 단위 올림. 차액은 총무가 떠안음(총무가 덜 냄)
    if (unit > 1 && byId[treasurer]) {
      let diff = 0;
      ids.forEach((id) => {
        if (id === treasurer || fixedIds.includes(id) || share[id] === 0) return;
        const up = Math.ceil(share[id] / unit) * unit;
        diff += up - share[id];
        share[id] = up;
      });
      share[treasurer] -= diff;
    }

    // 4) 누가 얼마를 결제했는지 → 최소 송금 목록
    const paid = Object.fromEntries(ids.map((id) => [id, 0]));
    rounds.forEach((r) => {
      const payer = byId[r.payer] ? r.payer : treasurer;
      if (payer) paid[payer] += roundTotal(r);
    });
    const transfers = settle(ids.map((id) => ({ id, balance: paid[id] - share[id] })));

    return {
      total,
      treasurer,
      people: people.map((p) => ({
        id: p.id,
        name: p.name,
        share: share[p.id],
        paid: paid[p.id],
        rounds: perRound.map((pr) => pr.shares[p.id]),
      })),
      rounds: perRound.map((pr) => ({ name: pr.round.name, total: roundTotal(pr.round), attendees: pr.attendees.length })),
      transfers,
      warnings,
    };
  }

  // 받을 사람/보낼 사람을 큰 금액부터 짝지어 송금 횟수를 줄임
  function settle(balances) {
    const recv = balances.filter((b) => b.balance > 0).map((b) => ({ ...b })).sort((a, b) => b.balance - a.balance);
    const send = balances.filter((b) => b.balance < 0).map((b) => ({ id: b.id, balance: -b.balance })).sort((a, b) => b.balance - a.balance);
    const out = [];
    let i = 0;
    let j = 0;
    while (i < send.length && j < recv.length) {
      const amt = Math.min(send[i].balance, recv[j].balance);
      if (amt > 0) out.push({ from: send[i].id, to: recv[j].id, amount: amt });
      send[i].balance -= amt;
      recv[j].balance -= amt;
      if (send[i].balance === 0) i++;
      if (recv[j].balance === 0) j++;
    }
    return out;
  }

  const api = { splitInt, calculate, settle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NBbang = api;
})(this);
