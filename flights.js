// 샘플 항공권 데이터 (전세계 노선, 날짜/항공사별 다양화)
const FLIGHTS = [
  // 서울 -> 도쿄
  { id: 1, airline: "진에어", origin: "서울", destination: "도쿄", price: 189000, duration: 135, stops: 0, date: "2026-10-05" },
  { id: 2, airline: "대한항공", origin: "서울", destination: "도쿄", price: 245000, duration: 130, stops: 0, date: "2026-10-05" },
  { id: 3, airline: "제주항공", origin: "서울", destination: "도쿄", price: 162000, duration: 140, stops: 0, date: "2026-10-08" },
  { id: 4, airline: "아시아나항공", origin: "서울", destination: "도쿄", price: 210000, duration: 132, stops: 0, date: "2026-10-12" },
  { id: 5, airline: "티웨이항공", origin: "서울", destination: "도쿄", price: 175000, duration: 138, stops: 0, date: "2026-10-15" },

  // 서울 -> 오사카
  { id: 6, airline: "제주항공", origin: "서울", destination: "오사카", price: 156000, duration: 120, stops: 0, date: "2026-10-06" },
  { id: 7, airline: "아시아나항공", origin: "서울", destination: "오사카", price: 198000, duration: 115, stops: 0, date: "2026-10-06" },
  { id: 8, airline: "에어부산", origin: "서울", destination: "오사카", price: 143000, duration: 118, stops: 0, date: "2026-10-11" },
  { id: 9, airline: "진에어", origin: "서울", destination: "오사카", price: 168000, duration: 122, stops: 0, date: "2026-10-20" },

  // 서울 -> 방콕
  { id: 10, airline: "티웨이항공", origin: "서울", destination: "방콕", price: 312000, duration: 345, stops: 0, date: "2026-10-10" },
  { id: 11, airline: "대한항공", origin: "서울", destination: "방콕", price: 389000, duration: 330, stops: 0, date: "2026-10-10" },
  { id: 12, airline: "에어아시아", origin: "서울", destination: "방콕", price: 278000, duration: 420, stops: 1, date: "2026-10-14" },
  { id: 13, airline: "타이항공", origin: "서울", destination: "방콕", price: 356000, duration: 335, stops: 0, date: "2026-10-21" },
  { id: 14, airline: "제주항공", origin: "서울", destination: "방콕", price: 265000, duration: 350, stops: 0, date: "2026-10-28" },

  // 서울 -> 싱가포르
  { id: 15, airline: "싱가포르항공", origin: "서울", destination: "싱가포르", price: 456000, duration: 390, stops: 0, date: "2026-10-12" },
  { id: 16, airline: "스쿠트", origin: "서울", destination: "싱가포르", price: 298000, duration: 480, stops: 1, date: "2026-10-12" },
  { id: 17, airline: "아시아나항공", origin: "서울", destination: "싱가포르", price: 412000, duration: 395, stops: 0, date: "2026-10-19" },
  { id: 18, airline: "스쿠트", origin: "서울", destination: "싱가포르", price: 271000, duration: 470, stops: 1, date: "2026-10-26" },

  // 서울 -> 뉴욕
  { id: 19, airline: "대한항공", origin: "서울", destination: "뉴욕", price: 1250000, duration: 840, stops: 0, date: "2026-10-15" },
  { id: 20, airline: "델타항공", origin: "서울", destination: "뉴욕", price: 980000, duration: 900, stops: 1, date: "2026-10-15" },
  { id: 21, airline: "아시아나항공", origin: "서울", destination: "뉴욕", price: 1120000, duration: 850, stops: 0, date: "2026-10-22" },
  { id: 22, airline: "유나이티드항공", origin: "서울", destination: "뉴욕", price: 890000, duration: 920, stops: 1, date: "2026-11-02" },

  // 서울 -> 로스앤젤레스
  { id: 23, airline: "대한항공", origin: "서울", destination: "로스앤젤레스", price: 980000, duration: 690, stops: 0, date: "2026-10-16" },
  { id: 24, airline: "아시아나항공", origin: "서울", destination: "로스앤젤레스", price: 920000, duration: 700, stops: 0, date: "2026-10-23" },
  { id: 25, airline: "델타항공", origin: "서울", destination: "로스앤젤레스", price: 760000, duration: 730, stops: 1, date: "2026-11-01" },

  // 서울 -> 파리
  { id: 26, airline: "아시아나항공", origin: "서울", destination: "파리", price: 890000, duration: 780, stops: 0, date: "2026-10-18" },
  { id: 27, airline: "에어프랑스", origin: "서울", destination: "파리", price: 760000, duration: 810, stops: 1, date: "2026-10-18" },
  { id: 28, airline: "대한항공", origin: "서울", destination: "파리", price: 845000, duration: 785, stops: 0, date: "2026-10-25" },
  { id: 29, airline: "카타르항공", origin: "서울", destination: "파리", price: 695000, duration: 880, stops: 1, date: "2026-11-03" },

  // 서울 -> 런던
  { id: 30, airline: "대한항공", origin: "서울", destination: "런던", price: 910000, duration: 790, stops: 0, date: "2026-10-17" },
  { id: 31, airline: "영국항공", origin: "서울", destination: "런던", price: 830000, duration: 800, stops: 0, date: "2026-10-24" },
  { id: 32, airline: "카타르항공", origin: "서울", destination: "런던", price: 675000, duration: 890, stops: 1, date: "2026-11-04" },

  // 서울 -> 두바이
  { id: 33, airline: "에미레이트항공", origin: "서울", destination: "두바이", price: 720000, duration: 600, stops: 0, date: "2026-10-13" },
  { id: 34, airline: "대한항공", origin: "서울", destination: "두바이", price: 810000, duration: 610, stops: 0, date: "2026-10-27" },

  // 서울 -> 시드니
  { id: 35, airline: "대한항공", origin: "서울", destination: "시드니", price: 980000, duration: 630, stops: 0, date: "2026-10-09" },
  { id: 36, airline: "콴타스항공", origin: "서울", destination: "시드니", price: 860000, duration: 640, stops: 0, date: "2026-10-30" },
  { id: 37, airline: "젯스타", origin: "서울", destination: "시드니", price: 690000, duration: 660, stops: 1, date: "2026-11-06" },

  // 서울 -> 로마
  { id: 38, airline: "알이탈리아", origin: "서울", destination: "로마", price: 870000, duration: 800, stops: 0, date: "2026-10-19" },
  { id: 39, airline: "카타르항공", origin: "서울", destination: "로마", price: 705000, duration: 870, stops: 1, date: "2026-11-05" },

  // 부산 -> 도쿄 / 오사카
  { id: 40, airline: "부산항공", origin: "부산", destination: "도쿄", price: 165000, duration: 110, stops: 0, date: "2026-10-07" },
  { id: 41, airline: "제주항공", origin: "부산", destination: "오사카", price: 142000, duration: 100, stops: 0, date: "2026-10-07" },
  { id: 42, airline: "에어부산", origin: "부산", destination: "오사카", price: 138000, duration: 102, stops: 0, date: "2026-10-17" },
];

const REGION_BY_DESTINATION = {
  "도쿄": "아시아", "오사카": "아시아", "방콕": "아시아", "싱가포르": "아시아",
  "뉴욕": "북미", "로스앤젤레스": "북미",
  "파리": "유럽", "런던": "유럽", "로마": "유럽",
  "두바이": "중동",
  "시드니": "오세아니아",
};
