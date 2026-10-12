// 샘플 이용권 데이터 (가격은 예시)
const TICKETS = [
  // 캐리비안베이
  { id: 1, park: "캐리비안베이", seller: "공식 홈페이지", type: "종일권", price: 62000, hours: 9, date: "2026-07-04" },
  { id: 2, park: "캐리비안베이", seller: "현장 구매", type: "종일권", price: 78000, hours: 9, date: "2026-07-04" },
  { id: 3, park: "캐리비안베이", seller: "공식 홈페이지", type: "오후권", price: 49000, hours: 5, date: "2026-07-11" },
  { id: 4, park: "캐리비안베이", seller: "제휴카드 할인", type: "종일권", price: 55000, hours: 9, date: "2026-07-18" },
  { id: 5, park: "캐리비안베이", seller: "단체 예약", type: "종일권", price: 51000, hours: 9, date: "2026-07-25" },

  // 오션월드
  { id: 6, park: "오션월드", seller: "공식 홈페이지", type: "종일권", price: 58000, hours: 9, date: "2026-07-05" },
  { id: 7, park: "오션월드", seller: "현장 구매", type: "종일권", price: 72000, hours: 9, date: "2026-07-05" },
  { id: 8, park: "오션월드", seller: "공식 홈페이지", type: "오후권", price: 44000, hours: 5, date: "2026-07-12" },
  { id: 9, park: "오션월드", seller: "숙박 패키지", type: "종일권", price: 49000, hours: 9, date: "2026-07-19" },

  // 롯데워터파크
  { id: 10, park: "롯데워터파크", seller: "공식 홈페이지", type: "종일권", price: 54000, hours: 8, date: "2026-07-04" },
  { id: 11, park: "롯데워터파크", seller: "제휴카드 할인", type: "종일권", price: 47000, hours: 8, date: "2026-07-11" },
  { id: 12, park: "롯데워터파크", seller: "현장 구매", type: "오후권", price: 45000, hours: 4, date: "2026-07-18" },
  { id: 13, park: "롯데워터파크", seller: "공식 홈페이지", type: "오후권", price: 39000, hours: 4, date: "2026-07-26" },

  // 설악워터피아
  { id: 14, park: "설악워터피아", seller: "공식 홈페이지", type: "종일권", price: 46000, hours: 10, date: "2026-07-06" },
  { id: 15, park: "설악워터피아", seller: "숙박 패키지", type: "종일권", price: 39000, hours: 10, date: "2026-07-13" },
  { id: 16, park: "설악워터피아", seller: "현장 구매", type: "종일권", price: 52000, hours: 10, date: "2026-07-20" },

  // 리솜스파캐슬
  { id: 17, park: "리솜스파캐슬", seller: "공식 홈페이지", type: "종일권", price: 42000, hours: 10, date: "2026-07-05" },
  { id: 18, park: "리솜스파캐슬", seller: "단체 예약", type: "종일권", price: 35000, hours: 10, date: "2026-07-12" },
  { id: 19, park: "리솜스파캐슬", seller: "현장 구매", type: "오후권", price: 33000, hours: 5, date: "2026-07-19" },

  // 웅진플레이도시
  { id: 20, park: "웅진플레이도시", seller: "공식 홈페이지", type: "종일권", price: 38000, hours: 10, date: "2026-07-04" },
  { id: 21, park: "웅진플레이도시", seller: "제휴카드 할인", type: "종일권", price: 32000, hours: 10, date: "2026-07-18" },
  { id: 22, park: "웅진플레이도시", seller: "현장 구매", type: "오후권", price: 29000, hours: 5, date: "2026-07-25" },

  // 경주 캘리포니아비치
  { id: 23, park: "경주 캘리포니아비치", seller: "공식 홈페이지", type: "종일권", price: 44000, hours: 9, date: "2026-07-06" },
  { id: 24, park: "경주 캘리포니아비치", seller: "숙박 패키지", type: "종일권", price: 37000, hours: 9, date: "2026-07-20" },
  { id: 25, park: "경주 캘리포니아비치", seller: "현장 구매", type: "오후권", price: 34000, hours: 5, date: "2026-07-27" },
];

const REGION_BY_PARK = {
  "캐리비안베이": "수도권", "웅진플레이도시": "수도권",
  "오션월드": "강원", "설악워터피아": "강원",
  "리솜스파캐슬": "충청",
  "롯데워터파크": "영남", "경주 캘리포니아비치": "영남",
};
