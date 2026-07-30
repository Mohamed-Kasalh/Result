// ============================================================
// نتيجة الثانوية العامة - بحث كامل من المتصفح (بدون سيرفر)
// ============================================================

const CASE_LABELS = ['ناجح دور أول', 'دور ثان', 'راسب دور أول', 'غياب كلى دور أول', 'غير محدد'];
const MAX_TOTAL = 320;
const PAGE_SIZE = 20;

let seatingNos = null;      // Float64Array
let names = null;           // string[]
let normalizedNames = null; // string[]
let totals = null;          // Float64Array (NaN = missing)
let caseCodes = null;       // Uint8Array
let seatMap = null;         // Map(seatingNo -> index) for O(1) exact lookups

let filteredIndices = [];   // current search+filter matches
let currentPage = 1;
let suppressHashUpdate = false;

// Global Stats Store
let globalStats = {
  total: 0,
  passCount: 0,
  failCount: 0,
  sumScore: 0,
  validScoreCount: 0,
  maxScore: 0
};

// DOM Refs
const statusLine = document.getElementById('statusLine');
const qInput = document.getElementById('q');
const btn = document.getElementById('btn');
const meta = document.getElementById('meta');
const resultsEl = document.getElementById('results');

// Analytics DOM Refs
const statTotalStudents = document.getElementById('statTotalStudents');
const statPassRate = document.getElementById('statPassRate');
const statFailRate = document.getElementById('statFailRate');
const statAvgScore = document.getElementById('statAvgScore');
const statMaxScore = document.getElementById('statMaxScore');

const advToggle = document.getElementById('advToggle');
const filtersPanel = document.getElementById('filters');
const minScoreInput = document.getElementById('minScore');
const maxScoreInput = document.getElementById('maxScore');
const clearFiltersBtn = document.getElementById('clearFilters');
const quickChips = document.querySelectorAll('#quickChips .chip');

let activeStatus = ''; // '' = all, otherwise case-code string

const paginationEl = document.getElementById('pagination');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageIndicator = document.getElementById('pageIndicator');

const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const certCard = document.getElementById('certCard');
const certStamp = document.getElementById('certStamp');
const stampText = document.getElementById('stampText');
const modalName = document.getElementById('modalName');
const modalSeat = document.getElementById('modalSeat');
const modalTotal = document.getElementById('modalTotal');
const modalPercentFill = document.getElementById('modalPercentFill');
const modalPercent = document.getElementById('modalPercent');
const downloadBtn = document.getElementById('downloadBtn');
const shareBtn = document.getElementById('shareBtn');
const toast = document.getElementById('toast');

let currentModalIdx = null;

function normalize(s) {
  let out = '';
  for (const ch of s) {
    let c = ch;
    if (c === 'أ' || c === 'إ' || c === 'آ' || c === 'ٱ') c = 'ا';
    else if (c === 'ة') c = 'ه';
    else if (c === 'ى') c = 'ي';
    else if (c === 'ـ') continue;
    const code = c.codePointAt(0);
    if (code >= 0x064B && code <= 0x0652) continue;
    if (/\s/.test(c)) continue;
    out += c;
  }
  return out;
}

function updateAnalyticsUI(indices = null) {
  let count = 0, passCount = 0, failCount = 0, sumScore = 0, validScoreCount = 0, maxScore = 0;

  if (indices === null) {
    count = globalStats.total;
    passCount = globalStats.passCount;
    failCount = globalStats.failCount;
    sumScore = globalStats.sumScore;
    validScoreCount = globalStats.validScoreCount;
    maxScore = globalStats.maxScore;
  } else {
    count = indices.length;
    for (let i = 0; i < count; i++) {
      const idx = indices[i];
      const code = caseCodes[idx];
      if (code === 0) passCount++;
      else failCount++;

      const score = totals[idx];
      if (!Number.isNaN(score)) {
        sumScore += score;
        validScoreCount++;
        if (score > maxScore) maxScore = score;
      }
    }
  }

  const passRate = count > 0 ? ((passCount / count) * 100).toFixed(1) : 0;
  const failRate = count > 0 ? ((failCount / count) * 100).toFixed(1) : 0;
  const avgScore = validScoreCount > 0 ? (sumScore / validScoreCount).toFixed(1) : 0;

  statTotalStudents.textContent = count.toLocaleString('ar-EG');
  statPassRate.textContent = `${passRate.toLocaleString('ar-EG')}٪`;
  statFailRate.textContent = `${failRate.toLocaleString('ar-EG')}٪`;
  statAvgScore.textContent = avgScore.toLocaleString('ar-EG');
  statMaxScore.textContent = maxScore.toLocaleString('ar-EG');
}

async function loadData() {
  statusLine.textContent = 'جاري فك الضغط...';
  const b64 = window.__RESULTS_B64__;
  if (!b64) throw new Error('تعذر العثور على بيانات النتيجة.');

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  let text;
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    text = await new Response(stream).text();
  } else {
    throw new Error('المتصفح لا يدعم فك الضغط تلقائيًا.');
  }

  statusLine.textContent = 'جاري تجهيز الفهرس والمؤشرات الإحصائية...';
  const lines = text.split('\n');
  const n = lines.length;

  seatingNos = new Float64Array(n);
  totals = new Float64Array(n);
  caseCodes = new Uint8Array(n);
  names = new Array(n);
  normalizedNames = new Array(n);

  let count = 0;
  for (let i = 0; i < n; i++) {
    const line = lines[i];
    if (!line) continue;
    const p1 = line.indexOf('|');
    const p2 = line.indexOf('|', p1 + 1);
    const p3 = line.indexOf('|', p2 + 1);
    if (p1 < 0 || p2 < 0 || p3 < 0) continue;

    seatingNos[count] = +line.slice(0, p1);
    names[count] = line.slice(p1 + 1, p2);
    normalizedNames[count] = normalize(names[count]);
    const totalStr = line.slice(p2 + 1, p3);
    const score = totalStr === '' ? NaN : +totalStr;
    totals[count] = score;
    const cCode = +line.slice(p3 + 1);
    caseCodes[count] = cCode;

    // Single-pass inline analytics computation
    if (cCode === 0) globalStats.passCount++;
    else globalStats.failCount++;

    if (!Number.isNaN(score)) {
      globalStats.sumScore += score;
      globalStats.validScoreCount++;
      if (score > globalStats.maxScore) globalStats.maxScore = score;
    }

    count++;
  }

  seatingNos = seatingNos.subarray(0, count);
  totals = totals.subarray(0, count);
  caseCodes = caseCodes.subarray(0, count);
  names.length = count;
  normalizedNames.length = count;
  globalStats.total = count;

  seatMap = new Map();
  for (let i = 0; i < count; i++) seatMap.set(seatingNos[i], i);

  updateAnalyticsUI();
  statusLine.textContent = `تم تحميل ${count.toLocaleString('ar-EG')} سجل ونتيجة - جاهز للبحث`;
}

function searchIndices(query) {
  query = query.trim();
  if (!query) return null;

  if (/^\d+$/.test(query)) {
    const qNum = +query;
    const exactHits = [];
    const prefixHits = [];
    if (seatMap.has(qNum)) exactHits.push(seatMap.get(qNum));
    for (let i = 0; i < seatingNos.length; i++) {
      if (seatingNos[i] === qNum) continue;
      if (String(seatingNos[i]).startsWith(query)) prefixHits.push(i);
    }
    if (exactHits.length > 0 || prefixHits.length > 0) return exactHits.concat(prefixHits);
  }

  const normQuery = normalize(query);
  const tokens = query.split(/\s+/).filter(Boolean).map(normalize).filter(t => t.length > 0);

  const exact = [];
  const substring = [];
  const allWords = [];

  for (let i = 0; i < normalizedNames.length; i++) {
    const name = normalizedNames[i];
    if (name === normQuery) exact.push(i);
    else if (name.includes(normQuery)) substring.push(i);
    else if (tokens.length > 1 && tokens.every(tok => name.includes(tok))) allWords.push(i);
  }

  return exact.concat(substring).concat(allWords);
}

function passesFilters(idx) {
  if (activeStatus !== '' && String(caseCodes[idx]) !== activeStatus) return false;
  const minVal = minScoreInput.value === '' ? -Infinity : parseFloat(minScoreInput.value);
  const maxVal = maxScoreInput.value === '' ? Infinity : parseFloat(maxScoreInput.value);
  if (minVal !== -Infinity || maxVal !== Infinity) {
    const t = totals[idx];
    if (Number.isNaN(t)) return false;
    if (t < minVal || t > maxVal) return false;
  }
  return true;
}

function hasActiveFilters() {
  return activeStatus !== '' || minScoreInput.value !== '' || maxScoreInput.value !== '';
}

function statusClass(idx) {
  const desc = CASE_LABELS[caseCodes[idx]] ?? '';
  if (desc.includes('ناجح')) return 'pass';
  if (desc.includes('راسب') || desc.includes('غياب')) return 'fail';
  return 'pending';
}

function recompute() {
  const query = qInput.value;
  const rawMatches = searchIndices(query);

  if (rawMatches === null && !hasActiveFilters()) {
    filteredIndices = [];
    currentPage = 1;
    updateAnalyticsUI(null);
    renderEmptyPrompt();
    return;
  }

  let candidates;
  if (rawMatches !== null) {
    candidates = rawMatches;
  } else {
    candidates = [];
    for (let i = 0; i < seatingNos.length; i++) candidates.push(i);
  }

  filteredIndices = candidates.filter(passesFilters);
  currentPage = 1;
  updateAnalyticsUI(filteredIndices);
  renderPage();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderEmptyPrompt() {
  meta.textContent = '';
  resultsEl.innerHTML = '<li class="empty">اكتب اسمًا أو رقم جلوس بالأعلى، أو اختر حالة من الأزرار لعرض النتائج.</li>';
  paginationEl.hidden = true;
}

function renderPage() {
  if (filteredIndices.length === 0) {
    meta.textContent = 'عدد النتائج: 0';
    resultsEl.innerHTML = '<li class="empty">لا توجد نتائج مطابقة لبحثك أو للفلاتر المختارة</li>';
    paginationEl.hidden = true;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filteredIndices.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  meta.textContent = `عدد النتائج: ${filteredIndices.length.toLocaleString('ar-EG')}`;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredIndices.slice(start, start + PAGE_SIZE);

  resultsEl.innerHTML = '';
  for (const idx of pageItems) {
    const li = document.createElement('li');
    li.className = 'result-row';
    li.dataset.idx = String(idx);
    const total = Number.isNaN(totals[idx]) ? '-' : totals[idx];
    const desc = CASE_LABELS[caseCodes[idx]] ?? '';
    li.innerHTML = `
      <div>
        <div class="result-row-name">${escapeHtml(names[idx])}</div>
        <div class="result-row-sub">رقم الجلوس: <span class="num">${seatingNos[idx]}</span> · ${escapeHtml(desc)}</div>
      </div>
      <div class="result-row-right">
        <div class="result-row-total num ${statusClass(idx)}">${total}</div>
        <span class="row-arrow" aria-hidden="true">‹</span>
      </div>
    `;
    li.addEventListener('click', () => openModal(idx, true));
    resultsEl.appendChild(li);
  }

  if (totalPages > 1) {
    paginationEl.hidden = false;
    pageIndicator.textContent = `صفحة ${currentPage.toLocaleString('ar-EG')} من ${totalPages.toLocaleString('ar-EG')}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  } else {
    paginationEl.hidden = true;
  }
}

function openModal(idx, updateHash) {
  currentModalIdx = idx;
  const desc = CASE_LABELS[caseCodes[idx]] ?? '';
  const isPass = desc.includes('ناجح');
  const isFail = desc.includes('راسب') || desc.includes('غياب');
  const total = totals[idx];
  const hasTotal = !Number.isNaN(total);
  const percent = hasTotal ? (total / MAX_TOTAL * 100) : null;

  modalName.textContent = names[idx];
  modalSeat.textContent = String(seatingNos[idx]);
  modalTotal.textContent = hasTotal ? String(total) : '-';
  modalPercent.textContent = hasTotal ? percent.toFixed(1) : '-';
  modalPercentFill.style.width = hasTotal ? `${Math.max(0, Math.min(100, percent))}%` : '0%';

  stampText.textContent = desc || 'غير محدد';
  certStamp.classList.remove('fail', 'pending');
  if (isFail) certStamp.classList.add('fail');
  else if (!isPass) certStamp.classList.add('pending');

  certStamp.style.animation = 'none';
  void certStamp.offsetWidth;
  certStamp.style.animation = '';

  toast.hidden = true;
  modalOverlay.hidden = false;

  if (updateHash) {
    suppressHashUpdate = true;
    location.hash = `seating=${seatingNos[idx]}`;
    setTimeout(() => { suppressHashUpdate = false; }, 0);
  }

  if (isPass && typeof confetti === 'function') {
    confetti({
      particleCount: 140,
      spread: 75,
      startVelocity: 42,
      origin: { y: 0.35 },
      colors: ['#7c4dff', '#ec6fd8', '#5b9df9', '#1a9c5f']
    });
  }
}

function closeModal() {
  modalOverlay.hidden = true;
  currentModalIdx = null;
  if (location.hash.startsWith('#seating=')) {
    suppressHashUpdate = true;
    history.pushState('', document.title, location.pathname + location.search);
    suppressHashUpdate = false;
  }
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modalOverlay.hidden) closeModal(); });

downloadBtn.addEventListener('click', async () => {
  if (currentModalIdx === null || typeof html2canvas !== 'function') return;
  const originalLabel = downloadBtn.textContent;
  downloadBtn.textContent = 'جاري التجهيز...';
  downloadBtn.disabled = true;
  try {
    const canvas = await html2canvas(certCard, { backgroundColor: null, scale: 2 });
    const link = document.createElement('a');
    link.download = `نتيجة-${seatingNos[currentModalIdx]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error(err);
    showToast('تعذر إنشاء الصورة، حاول مرة أخرى');
  } finally {
    downloadBtn.textContent = originalLabel;
    downloadBtn.disabled = false;
  }
});

shareBtn.addEventListener('click', async () => {
  if (currentModalIdx === null) return;
  const idx = currentModalIdx;
  const seat = seatingNos[idx];
  const desc = CASE_LABELS[caseCodes[idx]] ?? '';
  const total = Number.isNaN(totals[idx]) ? '-' : totals[idx];
  const url = `${location.origin}${location.pathname}#seating=${seat}`;
  const text = `نتيجة ${names[idx]} (رقم الجلوس ${seat}): ${desc} - المجموع ${total} من ${MAX_TOTAL}\n${url}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'نتيجة الثانوية العامة', text, url });
    } catch (err) {}
  } else if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('تم نسخ النتيجة والرابط');
    } catch (err) {
      showToast('تعذر النسخ التلقائي، انسخ الرابط يدويًا');
    }
  } else {
    showToast('المتصفح لا يدعم المشاركة أو النسخ التلقائي');
  }
});

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
}

function handleHash() {
  if (suppressHashUpdate) return;
  const match = location.hash.match(/seating=(\d+)/);
  if (!match) { if (!modalOverlay.hidden) closeModal(); return; }
  const seat = +match[1];
  if (seatMap && seatMap.has(seat)) {
    openModal(seatMap.get(seat), false);
  }
}

window.addEventListener('hashchange', handleHash);

advToggle.addEventListener('click', () => {
  const isHidden = filtersPanel.hidden;
  filtersPanel.hidden = !isHidden;
  advToggle.setAttribute('aria-expanded', String(isHidden));
});

quickChips.forEach(chip => {
  chip.addEventListener('click', () => {
    activeStatus = chip.dataset.status;
    quickChips.forEach(c => c.classList.toggle('active', c === chip));
    recompute();
  });
});

minScoreInput.addEventListener('input', debounce(recompute, 200));
maxScoreInput.addEventListener('input', debounce(recompute, 200));
clearFiltersBtn.addEventListener('click', () => {
  activeStatus = '';
  quickChips.forEach(c => c.classList.toggle('active', c.dataset.status === ''));
  minScoreInput.value = '';
  maxScoreInput.value = '';
  recompute();
});

function debounce(fn, wait) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) { currentPage--; renderPage(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});
nextPageBtn.addEventListener('click', () => {
  currentPage++; renderPage(); window.scrollTo({ top: 0, behavior: 'smooth' });
});

qInput.addEventListener('input', debounce(recompute, 150));
qInput.addEventListener('keydown', e => { if (e.key === 'Enter') recompute(); });
btn.addEventListener('click', recompute);

function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  themeIcon.textContent = mode === 'dark' ? '☀️' : '🌙';
}

const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(prefersDark ? 'dark' : 'light');

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

renderEmptyPrompt();

loadData().then(() => {
  qInput.disabled = false;
  btn.disabled = false;
  handleHash();
}).catch(err => {
  statusLine.textContent = 'حدث خطأ: ' + err.message;
  console.error(err);
});
