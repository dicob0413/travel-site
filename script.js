const originSelect = document.getElementById("origin");
const regionSelect = document.getElementById("region");
const destinationSelect = document.getElementById("destination");
const sortSelect = document.getElementById("sort");
const searchBtn = document.getElementById("searchBtn");
const flightList = document.getElementById("flightList");
const resultCount = document.getElementById("resultCount");
const priceCalendar = document.getElementById("priceCalendar");
const calendarSubtitle = document.getElementById("calendarSubtitle");

let selectedDate = "";

function uniqueValues(key) {
  return [...new Set(FLIGHTS.map((f) => f[key]))];
}

function fillSelect(select, values, allLabel) {
  const prev = select.value;
  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = allLabel;
  select.appendChild(allOption);
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
  if (values.includes(prev)) select.value = prev;
}

function formatPrice(price) {
  return price.toLocaleString("ko-KR") + "원";
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}시간 ${m}분`;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

function sortFlights(flights, sortBy) {
  const sorted = [...flights];
  switch (sortBy) {
    case "price-asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "duration-asc":
      sorted.sort((a, b) => a.duration - b.duration);
      break;
  }
  return sorted;
}

function getBaseFilteredFlights() {
  const origin = originSelect.value;
  const region = regionSelect.value;
  const destination = destinationSelect.value;

  return FLIGHTS.filter((f) => {
    const matchesOrigin = !origin || f.origin === origin;
    const matchesRegion = !region || REGION_BY_DESTINATION[f.destination] === region;
    const matchesDestination = !destination || f.destination === destination;
    return matchesOrigin && matchesRegion && matchesDestination;
  });
}

function renderCalendar(baseFlights) {
  priceCalendar.innerHTML = "";

  if (baseFlights.length === 0) {
    calendarSubtitle.textContent = "";
    priceCalendar.innerHTML = '<p class="empty">비교할 항공권이 없습니다.</p>';
    return;
  }

  const byDate = {};
  baseFlights.forEach((f) => {
    if (!byDate[f.date] || f.price < byDate[f.date].price) {
      byDate[f.date] = f;
    }
  });

  const entries = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  const cheapest = entries.reduce((min, f) => (f.price < min.price ? f : min), entries[0]);

  const destination = destinationSelect.value;
  calendarSubtitle.textContent = destination
    ? `${destination} 노선 중 가장 저렴한 날짜는 ${formatDateLabel(cheapest.date)} · ${cheapest.airline} · ${formatPrice(cheapest.price)}`
    : `전체 노선 중 가장 저렴한 날짜는 ${formatDateLabel(cheapest.date)} · ${cheapest.destination} · ${cheapest.airline} · ${formatPrice(cheapest.price)}`;

  entries.forEach((f) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "date-chip";
    if (f.date === cheapest.date) chip.classList.add("cheapest");
    if (f.date === selectedDate) chip.classList.add("active");
    chip.innerHTML = `
      <span class="date-chip-date">${formatDateLabel(f.date)}</span>
      <span class="date-chip-price">${formatPrice(f.price)}</span>
      <span class="date-chip-meta">${destination ? "" : f.destination + " · "}${f.airline}</span>
    `;
    chip.addEventListener("click", () => {
      selectedDate = selectedDate === f.date ? "" : f.date;
      applyFilters();
    });
    priceCalendar.appendChild(chip);
  });
}

function renderFlights(flights) {
  flightList.innerHTML = "";
  resultCount.textContent = `${flights.length}개 항공권`;

  if (flights.length === 0) {
    flightList.innerHTML = '<p class="empty">조건에 맞는 항공권이 없습니다.</p>';
    return;
  }

  flights.forEach((flight) => {
    const card = document.createElement("article");
    card.className = "flight-card";
    card.innerHTML = `
      <div class="flight-main">
        <div class="airline">${flight.airline}</div>
        <div class="route">${flight.origin} → ${flight.destination}</div>
        <div class="meta">
          <span>${flight.date}</span>
          <span>${formatDuration(flight.duration)}</span>
          <span>${flight.stops === 0 ? "직항" : `경유 ${flight.stops}회`}</span>
        </div>
      </div>
      <div class="flight-price">
        <div class="price">${formatPrice(flight.price)}</div>
        <button class="select-btn">선택</button>
      </div>
    `;
    flightList.appendChild(card);
  });
}

function applyFilters() {
  const sortBy = sortSelect.value;
  const baseFlights = getBaseFilteredFlights();

  renderCalendar(baseFlights);

  let filtered = baseFlights;
  if (selectedDate) {
    filtered = filtered.filter((f) => f.date === selectedDate);
  }
  filtered = sortFlights(filtered, sortBy);
  renderFlights(filtered);
}

function init() {
  fillSelect(originSelect, uniqueValues("origin"), "전체 출발지");
  fillSelect(regionSelect, [...new Set(Object.values(REGION_BY_DESTINATION))], "전체 지역");
  fillSelect(destinationSelect, uniqueValues("destination"), "전체 도착지");

  searchBtn.addEventListener("click", applyFilters);
  sortSelect.addEventListener("change", applyFilters);
  regionSelect.addEventListener("change", () => {
    const region = regionSelect.value;
    const destsInRegion = uniqueValues("destination").filter(
      (d) => !region || REGION_BY_DESTINATION[d] === region
    );
    fillSelect(destinationSelect, destsInRegion, "전체 도착지");
    selectedDate = "";
    applyFilters();
  });
  destinationSelect.addEventListener("change", () => {
    selectedDate = "";
    applyFilters();
  });
  originSelect.addEventListener("change", applyFilters);

  applyFilters();
}

init();
