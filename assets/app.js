const KEY = 'english30.v1';
const app = document.getElementById('app');
const blank = { done: {}, me: { name: '', job: '', city: '' } };

function load() {
  try { return Object.assign({}, blank, JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch { return JSON.parse(JSON.stringify(blank)); }
}
let state = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dayOf = (n) => DAYS.find((x) => x.d === n);
const isDone = (n) => Boolean(state.done[n]);
const nextDay = () => (DAYS.find((x) => !isDone(x.d)) || DAYS[DAYS.length - 1]).d;
const stage = (n) => (n <= 6 ? 1 : n <= 18 ? 2 : 3);
const today = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };

function toast(msg) {
  document.querySelectorAll('.toast').forEach((e) => e.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.append(t); setTimeout(() => t.remove(), 2400);
}

function speak(text) {
  if (!('speechSynthesis' in window)) return toast('Trình duyệt này chưa hỗ trợ đọc.');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\.\.\./g, ''));
  u.lang = 'en-US'; u.rate = 0.8;
  const v = speechSynthesis.getVoices().find((x) => x.lang === 'en-US');
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

// Chunks của ngày ôn tập = gộp chunks các ngày trong khoảng ôn.
function targetChunks(day) {
  if (!day.review) return day.chunks;
  const out = [];
  for (let n = day.review[0]; n <= day.review[1]; n++) out.push(...(dayOf(n).chunks || []).slice(0, 2));
  return out;
}

// Ôn cách quãng tăng dần: lấy lại cụm của 1, 3 và 7 ngày trước.
function spacedReview(n) {
  const out = [];
  [1, 3, 7].forEach((gap, i) => {
    const src = dayOf(n - gap);
    if (!src || src.review || !src.chunks) return;
    out.push(src.chunks[(n + i) % src.chunks.length]);
    if (gap === 1) out.push(src.chunks[(n + 3) % src.chunks.length]);
  });
  return out.filter((c, i, a) => a.findIndex((x) => x[0] === c[0]) === i);
}

function buildPrompt(day) {
  const me = state.me;
  const about = [me.name && `name ${me.name}`, me.job && `job ${me.job}`, me.city && `city ${me.city}`].filter(Boolean).join(', ');
  const s = stage(day.d);
  const target = targetChunks(day).map((c) => c[0]);
  const review = spacedReview(day.d).map((c) => c[0]);
  let plan;
  if (day.review) {
    plan = 'This is a review. Do NOT say the phrases first. Ask the questions below one by one. Give no help unless I say "help".';
  } else if (s === 1) {
    plan = 'PART 1: Say each target phrase, one at a time, then say "Repeat." and wait. PART 2: Ask the questions below one by one. Never say "Repeat" after a question.';
  } else if (s === 2) {
    plan = 'PART 1: I will say each target phrase. Reply only "OK" or the correct version. PART 2: Ask the questions below one by one.';
  } else {
    plan = 'Do NOT say the phrases first. Stay in the scene and say the lines below one by one. I try to use the target phrases myself.';
  }
  return [
    `You are my English speaking partner. I am a Vietnamese beginner (CEFR A1).${about ? ` About me: ${about}.` : ''}`,
    '',
    'STRICT RULES FOR EVERY REPLY:',
    '1. Maximum 12 words. One sentence or one question only. Then stop and wait.',
    '2. Very simple, common words. Speak slowly.',
    '3. No lists. No explanations. No compliments. No tips.',
    '4. If my sentence is understandable and has no real grammar mistake, do NOT correct it. Go to the next item.',
    '5. If I make a real mistake: say the correct sentence once, then "Repeat." Fix only one mistake. Do not explain.',
    '6. After I repeat once, always go to the next item, even if it is not perfect. Never ask me to repeat twice.',
    '7. If I ask you a question, answer it in 12 words or fewer, then go to the next item.',
    '8. Commands I can say: "again" = repeat your last sentence slower. "shorter" = say it in fewer words. "help" = give me the first 3 words of an answer. "Vietnamese" = say your last sentence in Vietnamese, then say it again in English. All other replies stay in English.',
    '9. These rules stay on for the whole chat, even in voice mode.',
    '',
    `TODAY: ${day.t}`,
    day.role ? `ROLE: ${day.role}` : '',
    `TARGET PHRASES: ${target.join(' | ')}`,
    review.length ? `OLD PHRASES: ${review.join(' | ')}` : '',
    '',
    `PLAN: ${plan}`,
    'QUESTIONS OR LINES:',
    ...day.qs.map((q, i) => `${i + 1}. ${q}`),
    '',
    (review.length ? 'Before END: stop the role if any, and ask one simple question that makes me use an old phrase.\n' : '') + 'END: After the last one, say "Three fixes:" and give my 3 most important corrected sentences. Then stop. If I say "one more", repeat PART 2 with new, similar questions.',
    '',
    'Now reply with one word only: "Ready." I will switch to voice and say "Start".',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}

function renderHome() {
  const count = DAYS.filter((x) => isDone(x.d)).length;
  const n = nextDay(); const day = dayOf(n);
  const dates = Object.values(state.done).sort();
  const last = dates[dates.length - 1];
  let h = `<section class="card today">
    <p class="muted">${count === DAYS.length ? 'Bạn đã hoàn thành cả 30 ngày!' : 'Học tiếp hôm nay'}</p>
    <h2 class="hero">Ngày ${n}: ${esc(day.t)}</h2><p>${esc(day.goal)}</p>
    <a class="btn primary full" href="#/day/${n}">Vào bài (khoảng 25 phút)</a></section>
    <section class="card"><div class="step-h"><b>Đã học ${count}/${DAYS.length} ngày</b><span>${last ? 'Lần cuối: ' + last : 'Chưa bắt đầu'}</span></div>
    <div class="bar" role="img" aria-label="Tiến độ ${count} trên ${DAYS.length} ngày"><i style="width:${(count / DAYS.length) * 100}%"></i></div>
    <p class="muted">Lỡ một hôm thì chỉ cần học tiếp ngày kế tiếp, không cần học bù.</p></section>`;
  WEEKS.forEach((w) => {
    h += `<section class="week"><h2>${w.name}: ${esc(w.title)}</h2>`;
    for (let i = w.days[0]; i <= w.days[1]; i++) {
      const d = dayOf(i); const done = isDone(i);
      h += `<div class="day ${done ? 'done' : ''} ${d.review ? 'rev' : ''} ${i === n && !done ? 'now' : ''}">
        <label aria-label="Đánh dấu xong ngày ${i}"><input type="checkbox" data-tick="${i}" ${done ? 'checked' : ''}></label>
        <a href="#/day/${i}"><b>Ngày ${i}: ${esc(d.t)}</b><small>${done ? 'Xong ' + state.done[i] : d.review ? 'Ngày ôn tập' : esc(d.goal)}</small></a></div>`;
    }
    h += '</section>';
  });
  h += `<section class="card" style="margin-top:12px"><h2>Chuyển tiến độ sang máy khác</h2>
    <p class="muted">Dấu tick được lưu riêng trên từng trình duyệt. Bấm nút rồi mở link đó trên điện thoại để chép tiến độ sang.</p>
    <button class="btn full" data-share>Sao chép link tiến độ</button></section>`;
  app.innerHTML = h;
}

function renderDay(n) {
  const day = dayOf(n);
  if (!day) { location.hash = '#/'; return; }
  const review = spacedReview(n); const chunks = targetChunks(day); const done = isDone(n); const me = state.me;
  let h = `<div><p class="muted" style="margin-bottom:4px"><a href="#/">Lộ trình</a> · Ngày ${n}/30${day.review ? ' · Ôn tập' : ''}</p>
    <h2 class="hero">${esc(day.t)}</h2><p style="margin:0"><b>Mục tiêu:</b> ${esc(day.goal)}</p></div>`;
  if (review.length) {
    h += `<section class="card"><div class="step-h"><h2>1. Nhớ lại</h2><span>3 phút</span></div>
      <p class="muted">Nhìn tiếng Việt, tự nói tiếng Anh thành tiếng, rồi mới chạm để xem đáp án.</p>
      <div class="cols">${review.map((c) => `<button class="recall" data-reveal="${esc(c[0])}">${esc(c[1])}<span class="en hide">Chạm để xem</span></button>`).join('')}</div></section>`;
  }
  h += `<section class="card"><div class="step-h"><h2>${review.length ? '2' : '1'}. Nghe & nhại</h2><span>7 phút</span></div>
    <p class="muted">Bấm loa, nhại theo 3 lần, đúng nhịp đúng giọng. Đừng cố học từng từ, cứ học nguyên câu.</p>
    <div class="cols">${chunks.map((c) => `<div class="chunk"><button class="say" data-say="${esc(c[0])}" aria-label="Nghe: ${esc(c[0])}">▶</button><div><b>${esc(c[0])}</b><span>${esc(c[1])}</span></div></div>`).join('')}</div>
    ${day.pattern ? `<div class="tip"><b>Mẫu câu:</b> ${esc(day.pattern)}</div>` : ''}
    <div class="tip"><b>Phát âm:</b> ${esc(day.sound)}</div>
    <a class="btn full" href="${esc(day.listen.url)}" target="_blank" rel="noopener">Nghe thêm: ${esc(day.listen.label)}</a></section>`;
  h += `<section class="card"><div class="step-h"><h2>${review.length ? '3' : '2'}. Nói với Gemini</h2><span>10 phút</span></div>
    <ol><li>Bấm <b>Sao chép prompt</b>, mở app Gemini, dán vào chat chữ rồi gửi.</li>
    <li>Gemini đáp “Ready.” thì bấm nút <b>Live</b> ngay trong chat đó.</li><li>Nói <b>“Start”</b>. Cần nghĩ thì bấm <b>Hold</b> để tắt mic.</li></ol>
    <div class="tip"><b>Trả lời dài quá?</b> Nói ngay “Shorter” hoặc chạm vào màn hình để ngắt. Vẫn dài thì nói: “Remember the rules. Twelve words only.”</div>
    <div class="row"><button class="btn primary" data-copy>Sao chép prompt</button><a class="btn" href="https://gemini.google.com/app" target="_blank" rel="noopener">Mở Gemini</a></div>
    <details style="margin-top:10px"><summary class="muted">Xem prompt & điền thông tin của bạn</summary>
      <p class="muted" style="margin-top:8px">Điền một lần, mọi prompt sẽ tự có thông tin này.</p>
      <div class="fields"><input type="text" data-me="name" placeholder="Tên của bạn" aria-label="Tên" value="${esc(me.name)}">
      <input type="text" data-me="job" placeholder="Nghề (tiếng Anh, ví dụ: developer)" aria-label="Nghề" value="${esc(me.job)}">
      <input type="text" data-me="city" placeholder="Thành phố" aria-label="Thành phố" value="${esc(me.city)}"></div>
      <pre id="prompt">${esc(buildPrompt(day))}</pre></details></section>`;
  h += `<section class="card"><div class="step-h"><h2>${review.length ? '4' : '3'}. Tự kiểm tra</h2><span>5 phút</span></div>
    <p>${esc(day.self)}</p><p class="muted">Sau đó bấm End trong Gemini và đọc lại transcript, chép 3 câu Gemini đã sửa vào sổ.</p>
    <button class="btn full ${done ? '' : 'primary'}" data-finish="${n}">${done ? 'Đã xong ✓ (bấm để bỏ tick)' : 'Xong ngày này ✓'}</button></section>
    <div class="row">${n > 1 ? `<a class="btn" href="#/day/${n - 1}">← Ngày ${n - 1}</a>` : ''}${n < DAYS.length ? `<a class="btn" href="#/day/${n + 1}">Ngày ${n + 1} →</a>` : ''}</div>`;
  app.innerHTML = h;
}

function renderGuide() {
  app.innerHTML = `<h2 class="hero">Cách học để thật sự nói được</h2>
  <section class="card"><h2>Một buổi 25 phút</h2><ol>
    <li><b>Nhớ lại (3'):</b> tự nói lại câu cũ trước khi xem đáp án. Cố nhớ giúp nhớ lâu hơn đọc lại.</li>
    <li><b>Nghe & nhại (7'):</b> học cả cụm câu thay vì từ rời, để khi nói không phải ghép từng từ.</li>
    <li><b>Nói với Gemini (10'):</b> mục tiêu là bạn nói nhiều hơn Gemini.</li>
    <li><b>Tự kiểm tra (5'):</b> không nhìn bài, rồi đọc lại transcript.</li></ol>
    <p class="muted">Cụm câu cũ tự quay lại sau 1, 3 và 7 ngày. Cứ 6 ngày có một ngày ôn. Bài khó dần: tuần đầu có nhại theo, cuối lộ trình phải tự nghĩ câu.</p></section>
  <section class="card"><h2>Cài Gemini một lần</h2><ol>
    <li><b>Bật phụ đề:</b> trong màn hình Live, bấm biểu tượng phụ đề góc trên bên phải để vừa nghe vừa đọc.</li>
    <li><b>Chọn giọng rõ:</b> Cài đặt → Giọng của Gemini, nghe thử rồi chọn giọng dễ nghe nhất.</li>
    <li><b>Nếu phòng ồn:</b> tắt “Interrupt Live responses” để tiếng ồn không cắt lời Gemini. Bạn vẫn ngắt được bằng cách chạm màn hình.</li>
    <li><b>Đừng dùng Gem:</b> Google ghi Gem chưa dùng được với Live, nên cần dán prompt mỗi ngày.</li></ol></section>
  <section class="card"><h2>Câu lệnh nói trong lúc luyện</h2><div class="cmd">
    <b>“Shorter”</b><span>Nói ngắn lại</span><b>“Again”</b><span>Nhắc lại, chậm hơn</span>
    <b>“Help”</b><span>Gợi ý 3 từ đầu của câu trả lời</span><b>“Vietnamese”</b><span>Dịch câu vừa rồi sang tiếng Việt</span>
    <b>“One more”</b><span>Luyện thêm một lượt</span></div>
    <div class="tip">Gemini vẫn có thể quên luật, nhất là khi trò chuyện lâu. Khi đó, nói: “Remember the rules. Twelve words only.” Nếu vẫn dài, bấm End, mở chat mới và dán lại prompt.</div></section>
  <section class="card"><h2>Điều Gemini làm chưa tốt</h2><ul>
    <li><b>Phát âm:</b> đừng tin hoàn toàn. Nó có thể tự đoán ý bạn nên bỏ qua lỗi. Hãy nhìn phụ đề xem nó nghe ra chữ gì, và ghi âm để so với bản gốc.</li>
    <li><b>Hay khen:</b> prompt đã cấm khen, nên đừng lấy lời khen làm thước đo.</li>
    <li><b>Ngắt lời khi bạn ngừng lâu:</b> bấm Hold để suy nghĩ, rồi bấm Live để nói tiếp.</li></ul></section>
  <section class="card"><h2>Nguồn nghiên cứu</h2><ul>
    <li><a href="https://support.google.com/gemini/answer/15274899?hl=en" target="_blank" rel="noopener">Google: Hướng dẫn Gemini Live</a> (Hold, phụ đề, transcript, chuyển chat chữ ↔ Live, giới hạn Gem)</li>
    <li><a href="https://www.chappie.pro/guides/practise-english-with-chatgpt" target="_blank" rel="noopener">Chappie: Luyện nói với Gemini</a> (dán prompt rồi chuyển sang giọng nói; đơn vị viết tự nhận không trung lập)</li>
    <li><a href="https://roycross.blog/wp-content/uploads/2024/08/2007-four-strands-paul-nation.pdf" target="_blank" rel="noopener">Paul Nation: The Four Strands</a> (cân bằng nghe, nói, học ngôn ngữ, luyện trôi chảy)</li>
    <li><a href="https://en.wikipedia.org/wiki/Testing_effect" target="_blank" rel="noopener">Testing effect</a> và <a href="https://en.wikipedia.org/wiki/Spaced_repetition" target="_blank" rel="noopener">Spaced repetition</a> (cố nhớ, ôn cách quãng)</li>
    <li><a href="https://files.eric.ed.gov/fulltext/EJ1472138.pdf" target="_blank" rel="noopener">ERIC: Formulaic language</a> (cụm câu có sẵn giúp nói trôi chảy hơn)</li>
    <li><a href="https://www.coe.int/en/web/common-european-framework-reference-languages/table-1-cefr-3.3-common-reference-levels-global-scale" target="_blank" rel="noopener">CEFR: Các cấp độ</a>, bài nghe từ <a href="https://learnenglish.britishcouncil.org/skills/speaking/a1-speaking" target="_blank" rel="noopener">British Council</a> và <a href="https://learningenglish.voanews.com/p/5644.html" target="_blank" rel="noopener">VOA</a></li></ul></section>`;
}

function route() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  const hash = location.hash;
  const sync = hash.match(/^#\/sync\/(.+)$/);
  if (sync) {
    try {
      const incoming = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(sync[1])))));
      const clean = {};
      Object.keys(incoming.done || {}).forEach((k) => { if (dayOf(Number(k))) clean[k] = String(incoming.done[k]).slice(0, 10); });
      const total = Object.keys(clean).length;
      if (confirm(`Gộp ${total} ngày đã học vào trình duyệt này?`)) {
        state.done = Object.assign({}, clean, state.done);
        if (incoming.me) ['name', 'job', 'city'].forEach((f) => { if (!state.me[f] && incoming.me[f]) state.me[f] = String(incoming.me[f]).slice(0, 60); });
        save(); toast('Đã chép tiến độ.');
      }
    } catch { toast('Link tiến độ không hợp lệ.'); }
    location.hash = '#/'; return;
  }
  const m = hash.match(/^#\/day\/(\d+)$/);
  if (m) renderDay(Number(m[1])); else if (hash === '#/guide') renderGuide(); else renderHome();
  window.scrollTo(0, 0);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const a = document.createElement('textarea'); a.value = text; document.body.append(a); a.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {} a.remove(); return ok;
  }
}

function setDone(n, on) { if (on) state.done[n] = today(); else delete state.done[n]; save(); }

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-say],[data-reveal],[data-copy],[data-finish],[data-share]');
  if (!t) return;
  if (t.dataset.say) speak(t.dataset.say);
  if (t.dataset.reveal) {
    const span = t.querySelector('.en'); span.textContent = t.dataset.reveal; span.classList.remove('hide'); speak(t.dataset.reveal);
  }
  if ('copy' in t.dataset) {
    const n = Number(location.hash.split('/')[2]);
    toast((await copyText(buildPrompt(dayOf(n)))) ? 'Đã sao chép. Dán vào Gemini nhé!' : 'Chưa sao chép được. Hãy mở phần “Xem prompt” và copy tay.');
  }
  if (t.dataset.finish) {
    const n = Number(t.dataset.finish); const on = !isDone(n); setDone(n, on);
    if (on) { toast(n === DAYS.length ? 'Bạn đã xong 30 ngày!' : 'Tuyệt! Đã tick xong.'); location.hash = '#/'; } else renderDay(n);
  }
  if ('share' in t.dataset) {
    const code = btoa(unescape(encodeURIComponent(JSON.stringify({ done: state.done, me: state.me }))));
    const url = `${location.origin}${location.pathname}#/sync/${encodeURIComponent(code)}`;
    toast((await copyText(url)) ? 'Đã sao chép link. Gửi sang điện thoại rồi mở.' : url);
  }
});

document.addEventListener('change', (e) => {
  const n = e.target.dataset && e.target.dataset.tick;
  if (n) { setDone(Number(n), e.target.checked); renderHome(); }
});

document.addEventListener('input', (e) => {
  const f = e.target.dataset && e.target.dataset.me;
  if (!f) return;
  state.me[f] = e.target.value.slice(0, 60); save();
  const n = Number(location.hash.split('/')[2]); const p = document.getElementById('prompt');
  if (p && dayOf(n)) p.textContent = buildPrompt(dayOf(n));
});

window.addEventListener('hashchange', route);
route();
