// ── THEME ──
function applyTheme() {
  const cls = CLASSES[currentClassIdx];
  document.documentElement.style.setProperty('--theme', cls.theme);
}

// ── VIEW MODE ──
let currentViewMode = 'pdf'; // 'pdf' | 'jpg'
function setViewMode(mode) {
  currentViewMode = mode;
  const page = document.getElementById('a4page');
  if (mode === 'jpg') {
    page.classList.add('mode-jpg');
  } else {
    page.classList.remove('mode-jpg');
  }
  ['pdf', 'jpg'].forEach(m => {
    const btn = document.getElementById('vmbtn-' + m);
    if (btn) btn.classList.toggle('active', m === mode);
  });
  // PDF 저장/JPG 저장 버튼 강조
  const pdfBtn = document.getElementById('pdfBtn');
  const jpgBtn = document.getElementById('jpgBtn');
  if (pdfBtn) { pdfBtn.className = mode === 'pdf' ? 'tb-btn btn-theme' : 'tb-btn btn-gray'; }
  if (jpgBtn) { jpgBtn.className = mode === 'jpg' ? 'tb-btn btn-theme' : 'tb-btn btn-gray'; }
}

function setLabel(label) {
  document.getElementById('inputLabel').value = label;
  document.querySelectorAll('.label-preset-btn').forEach(b =>
    b.classList.toggle('active', b.textContent === label));
}

function setTime(start, end) {
  document.getElementById('inputStart').value = start;
  document.getElementById('inputEnd').value = end;
  document.querySelectorAll('.time-preset-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === start + '-' + end);
  });
}

// ── MODAL ──
let selectedColor = 'bc1';
let selectedMonoColor = 'mono1';

// theme 색에서 색조 변형 4개 생성
function makeMonoPalette(hex) {
  // hex → rgb
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  // 밝기/채도 변형: 기본, 밝게, 어둡게, 보색 혼합
  const variants = [
    [r, g, b],                                          // 기본
    [Math.min(255,Math.round(r*1.25+30)), Math.min(255,Math.round(g*1.25+30)), Math.min(255,Math.round(b*1.25+30))], // 밝게
    [Math.round(r*0.72), Math.round(g*0.72), Math.round(b*0.72)], // 어둡게
    [Math.min(255,Math.round(r*0.85+b*0.25)), Math.min(255,Math.round(g*0.85+r*0.2)), Math.min(255,Math.round(b*0.85+g*0.2))], // 색조 혼합
  ];
  return variants.map(([rv,gv,bv]) =>
    '#' + [rv,gv,bv].map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('')
  );
}

function getMonoColor(colorKey) {
  const cls = CLASSES[currentClassIdx];
  const palette = makeMonoPalette(cls.theme);
  const idx = parseInt(colorKey.replace('mono','')) - 1;
  return palette[idx] || cls.theme;
}

function buildMonoPicker() {
  const cls = CLASSES[currentClassIdx];
  const palette = makeMonoPalette(cls.theme);
  const picker = document.getElementById('monoColorPicker');
  picker.innerHTML = '';
  palette.forEach((hex, i) => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (i === 0 ? ' selected' : '');
    dot.style.background = hex;
    dot.dataset.c = 'mono' + (i+1);
    dot.onclick = () => selectMonoColor('mono' + (i+1));
    picker.appendChild(dot);
  });
}

function selectMonoColor(c) {
  selectedMonoColor = c;
  document.querySelectorAll('#monoColorPicker .color-dot').forEach(d =>
    d.classList.toggle('selected', d.dataset.c === c));
}
let editState = null; // { dateStr, idx } when editing

function selectColor(c) {
  selectedColor = c;
  document.querySelectorAll('.color-dot').forEach(d =>
    d.classList.toggle('selected', d.dataset.c === c));
}

function openModal(dateStr) {
  if (!canEdit()) return;
  editState = null;
  document.querySelector('.modal h3').textContent = '강습 추가';
  document.getElementById('modalConfirmBtn').textContent = '추가';
  document.getElementById('modalDeleteBtn').style.display = 'none';
  document.getElementById('inputDate').value = dateStr || (() => {
    const [mA] = PAGES[currentPage];
    const d = new Date(YEAR, mA, 1);
    while (d.getDay()===0||d.getDay()===6) d.setDate(d.getDate()+1);
    return CalendarDates.format(d);
  })();
  document.getElementById('inputLabel').value = '';
  document.querySelectorAll('.label-preset-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('inputStart').value = '14:00';
  document.getElementById('inputEnd').value = '14:50';
  document.querySelectorAll('.time-preset-btn').forEach(b =>
    b.classList.toggle('active', b.textContent === '14:00-14:50'));
  document.getElementById('applyWeekly').checked = false;
  document.getElementById('applyWeekly').parentElement.style.display = '';
  const _isMono = CLASSES[currentClassIdx].mono;
  document.getElementById('colorSection').style.display = _isMono ? 'none' : '';
  document.getElementById('monoColorSection').style.display = _isMono ? '' : 'none';
  if (_isMono) { buildMonoPicker(); selectMonoColor('mono1'); }
  document.getElementById('modalBackdrop').classList.add('open');
}

function openEditModal(dateStr, idx, e) {
  e.stopPropagation();
  if (!canEdit()) return;
  const m = parseInt(dateStr.split('-')[1]) - 1;
  const ls = allLessons[currentClassIdx][m][dateStr][idx];
  editState = { dateStr, idx, record: structuredClone(ls.record) };

  document.querySelector('.modal h3').textContent = '강습 수정';
  document.getElementById('modalConfirmBtn').textContent = '저장';
  document.getElementById('modalDeleteBtn').style.display = '';
  document.getElementById('inputDate').value = dateStr;
  document.getElementById('inputLabel').value = ls.label;
  document.querySelectorAll('.label-preset-btn').forEach(b =>
    b.classList.toggle('active', b.textContent === ls.label));
  document.getElementById('inputStart').value = ls.start;
  document.getElementById('inputEnd').value = ls.end;
  document.querySelectorAll('.time-preset-btn').forEach(b =>
    b.classList.toggle('active', b.textContent === ls.start + '-' + ls.end));
  document.getElementById('applyWeekly').parentElement.style.display = 'none';

  const isMono = CLASSES[currentClassIdx].mono;
  document.getElementById('colorSection').style.display = isMono ? 'none' : '';
  document.getElementById('monoColorSection').style.display = isMono ? '' : 'none';
  if (isMono) {
    buildMonoPicker();
    // hex로 저장된 경우 팔레트에서 일치하는 도트 찾아 선택
    if (ls.color && ls.color.startsWith('#')) {
      const cls2 = CLASSES[currentClassIdx];
      const palette = makeMonoPalette(cls2.theme);
      const matchIdx = palette.findIndex(h => h.toLowerCase() === ls.color.toLowerCase());
      const monoKey = matchIdx >= 0 ? 'mono' + (matchIdx + 1) : 'mono1';
      selectMonoColor(monoKey);
    } else {
      const savedMono = ls.color && ls.color.startsWith('mono') ? ls.color : 'mono1';
      selectMonoColor(savedMono);
    }
  } else if (ls.color !== 'mono') {
    selectColor(ls.color);
  }

  document.getElementById('modalBackdrop').classList.add('open');
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
  editState = null;
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modalBackdrop')) closeModal();
}

// ── PAGE NAV ──
function changePage(dir) {
  currentPage = Math.max(0, Math.min(PAGES.length-1, currentPage + dir));
  renderAll();
}

// ── BUILD HALF ──
function buildHalf(container, month, isSecondHalf) {
  container.innerHTML = '';
  const cls = CLASSES[currentClassIdx];
  const branch = BRANCHES[currentBranch];
  const titleSuffix = escapeHTML(cls.name);
  const lessons = allLessons[currentClassIdx];

  // header
  const header = document.createElement('div');
  header.className = 'm-header';
  // 두 번째 half(하단)는 지점명 숨김
  const branchHTML = isSecondHalf ? '' : `
    <div class="branch-row">
      <img class="fish-icon-img" src="${LOGOS[currentBranch]}" alt="logo">
      <span>${branch}</span>
    </div>`;
  header.innerHTML = branchHTML + `<div class="m-title">${MONTH_KO[month]} ${titleSuffix}</div>`;
  container.appendChild(header);

  // day headers
  const dhRow = document.createElement('div');
  dhRow.className = 'day-headers';
  ['월','화','수','목','금'].forEach(d => {
    const dh = document.createElement('div');
    dh.className = 'dh';
    dh.textContent = d;
    dhRow.appendChild(dh);
  });
  container.appendChild(dhRow);

  // grid
  const grid = document.createElement('div');
  grid.className = 'cal-grid';

  const { gridStart, totalWeeks, showNovemberFirstWeek } = CalendarDates.layout(YEAR, month);
  const daysInMonth = new Date(YEAR, month+1, 0).getDate();
  grid.style.setProperty('--calendar-weeks', totalWeeks);

  for (let w = 0; w < totalWeeks; w++) {

    const row = document.createElement('div');
    row.className = 'cal-row';
    for (let d = 0; d < 5; d++) {
      const cellDate = new Date(gridStart.getTime() + (w*7+d)*86400000);
      const cell = document.createElement('div');

      const cellMonth = cellDate.getMonth();
      const isNextMonth = cellMonth !== month && cellDate > new Date(YEAR, month, daysInMonth);

      // 위 달의 다음달은 숨기되, 10월의 11월 첫째 주는 표시합니다.
      if (cellMonth !== month && (!isNextMonth || (!isSecondHalf && !showNovemberFirstWeek))) {
        cell.className = 'cal-cell empty';
      } else {
        // 현재달 셀 또는 아래 달의 overflow 셀
        cell.className = isNextMonth ? 'cal-cell empty' : 'cal-cell';
        const day = cellDate.getDate();
        const cm = cellMonth;
        const dateStr = CalendarDates.format(cellDate);

        const numEl = document.createElement('div');
        numEl.className = 'date-num';
        numEl.style.color = isNextMonth ? '#bbb' : '';
        numEl.textContent = day;
        cell.appendChild(numEl);

        if (!lessons[cm]) lessons[cm] = {};
        const dayLessons = lessons[cm][dateStr] || [];
        const count = dayLessons.length;
        dayLessons.forEach((ls, idx) => {
          const badge = document.createElement('div');
          const delBtn = document.createElement('span');
          delBtn.className = 'badge-del';
          delBtn.textContent = '✕';
          delBtn.onclick = (e) => { e.stopPropagation(); deleteLesson(dateStr, idx); };

          const isMono = cls.mono || (ls.color && (ls.color.startsWith('mono') || ls.color.startsWith('#')));
          if (isMono) {
            // 다풀자: 1개=세로2줄(mono-solo), 2개 이상=가로1줄(badge-small)
            const monoSize = count === 1 ? 'mono-solo' : 'badge-small';
            badge.className = `lesson-badge mono ${monoSize}`;
            // hex로 저장된 경우 직접 사용, 구버전 'mono1' 키는 변환
            const bgColor = ls.color && ls.color.startsWith('#')
              ? ls.color
              : getMonoColor(ls.color && ls.color.startsWith('mono') ? ls.color : 'mono1');
            badge.style.background = bgColor;
            badge.style.cursor = 'pointer';
            badge.onclick = (e) => openEditModal(dateStr, idx, e);
          } else {
            // 기초: 1개=large, 2개=medium, 3개 이상=small
            const kisoSize = count === 1 ? 'badge-large' : count === 2 ? 'badge-medium' : 'badge-small';
            badge.className = `lesson-badge ${ls.color} ${kisoSize}`;
            badge.style.cursor = 'pointer';
            badge.onclick = (e) => openEditModal(dateStr, idx, e);
          }
          const lbl = document.createElement('span');
          lbl.className = 'badge-label';
          lbl.textContent = ls.label;
          const tim = document.createElement('span');
          tim.className = 'badge-time';
          tim.textContent = ls.start + '-' + ls.end;
          badge.appendChild(lbl);
          badge.appendChild(tim);
          badge.appendChild(delBtn);
          cell.appendChild(badge);
        });

        const addBtn = document.createElement('button');
        addBtn.className = 'add-cell-btn';
        addBtn.textContent = '＋ 추가';
        addBtn.onclick = () => openModal(dateStr);
        cell.appendChild(addBtn);
      }
      row.appendChild(cell);
    }
    grid.appendChild(row);
  }
  container.appendChild(grid);


}

function renderAll() {
  const [mA, mB] = PAGES[currentPage];
  document.getElementById('pageLabel').textContent = `${MONTH_KO[mA]} + ${MONTH_KO[mB]}`;
  buildHalf(document.getElementById('half0'), mA, false);
  buildHalf(document.getElementById('half1'), mB, true);
  const theme = CLASSES[currentClassIdx].theme;
  const svgBar = (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="16" preserveAspectRatio="none"><rect width="100%" height="16" fill="${c}"/></svg>`;
  document.getElementById('bar-mid').innerHTML = svgBar(theme);

}

