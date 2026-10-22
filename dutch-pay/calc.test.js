// 실행: node dutch-pay/calc.test.js
const assert = require('node:assert');
const { splitInt, calculate } = require('./calc.js');

const sum = (a) => a.reduce((x, y) => x + y, 0);
const shareOf = (res, id) => res.people.find((p) => p.id === id).share;

// 나눠떨어지지 않아도 합계는 정확히 유지
assert.deepStrictEqual(splitInt(10000, [1, 1, 1]), [3334, 3333, 3333]);
assert.strictEqual(sum(splitInt(99999, [1, 1.5, 0.8, 2])), 99999);

const people = [
  { id: 'a', name: '김선배', weight: 1.5, drinks: true },
  { id: 'b', name: '이동기', weight: 1, drinks: true },
  { id: 'c', name: '박운전', weight: 1, drinks: false },
  { id: 'd', name: '최막내', weight: 1, drinks: true },
];

// 술 안 마신 사람은 술값 제외 + 2차는 참석자만
{
  const res = calculate({
    people,
    unit: 1,
    treasurer: 'b',
    rounds: [
      { id: 'r1', name: '1차', food: 90000, alcohol: 45000, payer: 'b', attendees: ['a', 'b', 'c', 'd'] },
      { id: 'r2', name: '2차', food: 0, alcohol: 50000, payer: 'b', attendees: ['b', 'd'] },
    ],
  });
  assert.strictEqual(res.total, 185000);
  assert.strictEqual(sum(res.people.map((p) => p.share)), 185000);
  // 1차 음식 90000 / 4.5 = 20000 per weight, 술 45000 / 3.5
  assert.strictEqual(shareOf(res, 'c'), 20000);
  assert.strictEqual(shareOf(res, 'a'), 30000 + Math.round((45000 * 1.5) / 3.5));
  // 총무 b가 전부 결제 → 나머지 셋이 b에게 송금
  assert.ok(res.transfers.every((t) => t.to === 'b'));
  assert.strictEqual(sum(res.transfers.map((t) => t.amount)), 185000 - shareOf(res, 'b'));
}

// 단위 올림: 총무 외에는 1000원 단위, 합계 유지
{
  const res = calculate({
    people,
    unit: 1000,
    treasurer: 'b',
    rounds: [{ id: 'r1', name: '1차', food: 100000, alcohol: 33333, payer: 'b', attendees: ['a', 'b', 'c', 'd'] }],
  });
  assert.strictEqual(sum(res.people.map((p) => p.share)), 133333);
  ['a', 'c', 'd'].forEach((id) => assert.strictEqual(shareOf(res, id) % 1000, 0));
}

// 고정 금액: 부장님이 10만원 내고 나머지는 비율대로
{
  const res = calculate({
    people: [{ ...people[0], fixed: 100000 }, people[1], people[2]],
    unit: 1,
    treasurer: 'b',
    rounds: [{ id: 'r1', name: '1차', food: 160000, alcohol: 0, payer: 'a', attendees: ['a', 'b', 'c'] }],
  });
  assert.strictEqual(shareOf(res, 'a'), 100000);
  assert.strictEqual(shareOf(res, 'b'), 30000);
  assert.strictEqual(shareOf(res, 'c'), 30000);
  assert.deepStrictEqual(
    res.transfers.map((t) => [t.from, t.to, t.amount]).sort(),
    [['b', 'a', 30000], ['c', 'a', 30000]]
  );
}

// 차수별 결제자가 다르면 서로 상계
{
  const res = calculate({
    people: people.slice(0, 2).map((p) => ({ ...p, weight: 1 })),
    unit: 1,
    rounds: [
      { id: 'r1', name: '1차', food: 40000, alcohol: 0, payer: 'a', attendees: ['a', 'b'] },
      { id: 'r2', name: '2차', food: 20000, alcohol: 0, payer: 'b', attendees: ['a', 'b'] },
    ],
  });
  assert.deepStrictEqual(res.transfers, [{ from: 'b', to: 'a', amount: 10000 }]);
}

console.log('all tests passed');
