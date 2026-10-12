const regionSelect = document.getElementById("region");
const parkSelect = document.getElementById("park");
const typeSelect = document.getElementById("type");
const sortSelect = document.getElementById("sort");
const searchBtn = document.getElementById("searchBtn");
const ticketList = document.getElementById("ticketList");
const resultCount = document.getElementById("resultCount");
const priceCalendar = document.getElementById("priceCalendar");
const calendarSubtitle = document.getElementById("calendarSubtitle");

let selectedDate = "";

function uniqueValues(key) {
  return [...new Set(TICKETS.map((t) => t[key]))];
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

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

function sortTickets(tickets, sortBy) {
  const sorted = [...tickets];
  switch (sortBy) {
    case "price-asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "hours-desc":
      sorted.sort((a, b) => b.hours - a.hours || a.price - b.price);
      break;
  }
  return sorted;
}

function getBaseFilteredTickets() {
  const region = regionSelect.value;
  const park = parkSelect.value;
  const type = typeSelect.value;

  return TICKETS.filter((t) => {
    const matchesRegion = !region || REGION_BY_PARK[t.park] === region;
    const matchesPark = !park || t.park === park;
    const matchesType = !type || t.type === type;
    return matchesRegion && matchesPark && matchesType;
  });
}

function renderCalendar(baseTickets) {
  priceCalendar.innerHTML = "";

  if (baseTickets.length === 0) {
    calendarSubtitle.textContent = "";
    priceCalendar.innerHTML = '<p class="empty">비교할 이용권이 없습니다.</p>';
    return;
  }

  const byDate = {};
  baseTickets.forEach((t) => {
    if (!byDate[t.date] || t.price < byDate[t.date].price) {
      byDate[t.date] = t;
    }
  });

  const entries = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  const cheapest = entries.reduce((min, t) => (t.price < min.price ? t : min), entries[0]);

  const park = parkSelect.value;
  calendarSubtitle.textContent = park
    ? `최저가 ${formatDateLabel(cheapest.date)} ${cheapest.seller} ${formatPrice(cheapest.price)}`
    : `최저가 ${formatDateLabel(cheapest.date)} ${cheapest.park} ${cheapest.seller} ${formatPrice(cheapest.price)}`;

  entries.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "date-chip";
    if (t.date === cheapest.date) chip.classList.add("cheapest");
    if (t.date === selectedDate) chip.classList.add("active");
    chip.innerHTML = `
      <span class="date-chip-date">${formatDateLabel(t.date)}</span>
      <span class="date-chip-price">${formatPrice(t.price)}</span>
      <span class="date-chip-meta">${park ? t.seller : t.park}</span>
    `;
    chip.addEventListener("click", () => {
      selectedDate = selectedDate === t.date ? "" : t.date;
      applyFilters();
    });
    priceCalendar.appendChild(chip);
  });
}

function renderTickets(tickets) {
  ticketList.innerHTML = "";
  resultCount.textContent = `이용권 ${tickets.length}개`;

  if (tickets.length === 0) {
    ticketList.innerHTML = '<p class="empty">조건에 맞는 이용권이 없습니다.</p>';
    return;
  }

  tickets.forEach((ticket) => {
    const card = document.createElement("article");
    card.className = "ticket-card";
    card.innerHTML = `
      <div class="ticket-main">
        <div class="seller">${ticket.seller}</div>
        <div class="park-name">${ticket.park} ${ticket.type}</div>
        <div class="meta">
          <span>${ticket.date}</span>
          <span>${REGION_BY_PARK[ticket.park]}</span>
          <span>${ticket.hours}시간 이용</span>
        </div>
      </div>
      <div class="ticket-price">
        <div class="price">${formatPrice(ticket.price)}</div>
        <button class="select-btn">선택</button>
      </div>
    `;
    ticketList.appendChild(card);
  });
}

function applyFilters() {
  const sortBy = sortSelect.value;
  const baseTickets = getBaseFilteredTickets();

  renderCalendar(baseTickets);

  let filtered = baseTickets;
  if (selectedDate) {
    filtered = filtered.filter((t) => t.date === selectedDate);
  }
  filtered = sortTickets(filtered, sortBy);
  renderTickets(filtered);
}

function init() {
  fillSelect(regionSelect, [...new Set(Object.values(REGION_BY_PARK))], "전체 지역");
  fillSelect(parkSelect, uniqueValues("park"), "전체 워터파크");
  fillSelect(typeSelect, uniqueValues("type"), "전체 이용권");

  searchBtn.addEventListener("click", applyFilters);
  sortSelect.addEventListener("change", applyFilters);
  regionSelect.addEventListener("change", () => {
    const region = regionSelect.value;
    const parksInRegion = uniqueValues("park").filter(
      (p) => !region || REGION_BY_PARK[p] === region
    );
    fillSelect(parkSelect, parksInRegion, "전체 워터파크");
    selectedDate = "";
    applyFilters();
  });
  parkSelect.addEventListener("change", () => {
    selectedDate = "";
    applyFilters();
  });
  typeSelect.addEventListener("change", applyFilters);

  applyFilters();
}

init();
