// ============================================================
// نتيجة الثانوية العامة - بحث كامل من المتصفح (بدون سيرفر)
// ============================================================

const CASE_LABELS = ['ناجح دور أول', 'دور ثان', 'راسب دور أول', 'غياب كلى دور أول', 'غير محدد'];

let seatingNos = null;   // Float64Array
let names = null;        // string[]
let normalizedNames = null; // string[]
let totals = null;       // Float64Array (NaN = missing)
let caseCodes = null;    // Uint8Array

const statusLine = document.getElementById('statusLine');
const qInput = document.getElementById('q');
const btn = document.getElementById('btn');
const meta = document.getElementById('meta');
const resultsEl = document.getElementById('results');

function normalize(s) {
  let out = '';
  for (const ch of s) {
    let c = ch;
    if (c === 'أ' || c === 'إ' || c === 'آ' || c === 'ٱ') c = 'ا';
    else if (c === 'ة') c = 'ه';
    else if (c === 'ى') c = 'ي';
    else if (c === 'ـ') continue;
    const code = c.codePointAt(0);
    if (code >= 0x064B && code <= 0x0652) continue; // Arabic diacritics (tashkeel)
    if (/\s/.test(c)) continue;
    out += c;
  }
  return out;
}

async function loadData() {
  statusLine.textContent = 'جاري تحميل ملف النتيجة...';
  const res = await fetch('data/results.txt.gz');
  if (!res.ok) throw new Error('تعذر تحميل ملف البيانات');

  const compressedBuffer = await res.arrayBuffer();

  statusLine.textContent = 'جاري فك الضغط...';
  let text;
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([compressedBuffer]).stream().pipeThrough(ds);
    text = await new Response(stream).text();
  } else {
    throw new Error('المتصفح لا يدعم فك الضغط تلقائيًا. حدّث المتصفح أو استخدم Chrome/Edge/Firefox حديث.');
  }

  statusLine.textContent = 'جاري تجهيز الفهرس...';
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

    const seating = +line.slice(0, p1);
    const name = line.slice(p1 + 1, p2);
    const totalStr = line.slice(p2 + 1, p3);
    const code = +line.slice(p3 + 1);

    seatingNos[count] = seating;
    names[count] = name;
    normalizedNames[count] = normalize(name);
    totals[count] = totalStr === '' ? NaN : +totalStr;
    caseCodes[count] = code;
    count++;
  }

  // trim arrays to actual count (in case of trailing empty lines)
  seatingNos = seatingNos.subarray(0, count);
  totals = totals.subarray(0, count);
  caseCodes = caseCodes.subarray(0, count);
  names.length = count;
  normalizedNames.length = count;

  statusLine.textContent = `تم تحميل ${count.toLocaleString('ar-EG')} سجل ونتيجة - جاهز للبحث`;
}

function search(query, limit = 100) {
  query = query.trim();
  if (!query) return { count: 0, results: [] };

  // Numeric query -> seating number lookup (exact first, then prefix)
  if (/^\d+$/.test(query)) {
    const exactHits = [];
    const prefixHits = [];
    for (let i = 0; i < seatingNos.length; i++) {
      const seatStr = String(seatingNos[i]);
      if (seatStr === query) exactHits.push(toHit(i, 'Exact'));
      else if (seatStr.startsWith(query) && prefixHits.length < limit) prefixHits.push(toHit(i, 'Substring'));
    }
    if (exactHits.length > 0 || prefixHits.length > 0) {
      const combined = exactHits.concat(prefixHits).slice(0, limit);
      return { count: combined.length, results: combined };
    }
    // fall through to name search just in case
  }

  const normQuery = normalize(query);
  const tokens = query.split(/\s+/).filter(Boolean).map(normalize).filter(t => t.length > 0);

  const exact = [];
  const substring = [];
  const allWords = [];

  for (let i = 0; i < normalizedNames.length; i++) {
    const name = normalizedNames[i];
    if (name === normQuery) {
      exact.push(i);
    } else if (name.includes(normQuery)) {
      substring.push(i);
    } else if (tokens.length > 1 && tokens.every(tok => name.includes(tok))) {
      allWords.push(i);
    }
  }

  const results = []
    .concat(exact.map(i => toHit(i, 'Exact')))
    .concat(substring.map(i => toHit(i, 'Substring')))
    .concat(allWords.map(i => toHit(i, 'AllWords')))
    .slice(0, limit);

  return { count: results.length, results };
}

function toHit(i, kind) {
  return {
    seatingNo: seatingNos[i],
    name: names[i],
    total: Number.isNaN(totals[i]) ? null : totals[i],
    caseDesc: CASE_LABELS[caseCodes[i]] ?? '',
    kind
  };
}

function kindLabel(k) {
  if (k === 'Exact') return 'تطابق تام';
  if (k === 'Substring') return 'تطابق جزئي';
  return 'تطابق كل الكلمات';
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function render(data) {
  resultsEl.innerHTML = '';
  if (!data.results || data.results.length === 0) {
    meta.textContent = '';
    resultsEl.innerHTML = '<div class="empty">لا توجد نتائج مطابقة</div>';
    return;
  }
  meta.textContent = `عدد النتائج: ${data.count}`;
  for (const r of data.results) {
    const card = document.createElement('div');
    card.className = 'result-card';
    const passed = (r.caseDesc || '').includes('ناجح');
    card.innerHTML = `
      <div>
        <div class="result-name">${escapeHtml(r.name)}</div>
        <div class="result-sub">رقم الجلوس: ${r.seatingNo} · ${escapeHtml(r.caseDesc || '')}
          <span class="badge ${r.kind === 'Exact' ? 'exact' : ''}">${kindLabel(r.kind)}</span>
        </div>
      </div>
      <div class="total ${passed ? 'pass' : 'fail'}">${r.total ?? '-'}</div>
    `;
    resultsEl.appendChild(card);
  }
}

function doSearch() {
  const query = qInput.value;
  if (!query.trim()) { resultsEl.innerHTML = ''; meta.textContent = ''; return; }
  const data = search(query);
  render(data);
}

let debounceTimer = null;
qInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(doSearch, 150);
});
qInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
btn.addEventListener('click', doSearch);

loadData().then(() => {
  qInput.disabled = false;
  btn.disabled = false;
}).catch(err => {
  statusLine.textContent = 'حدث خطأ: ' + err.message;
  console.error(err);
});
