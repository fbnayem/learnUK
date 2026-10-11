// Learn UK site behaviour. Everything here enhances working HTML; the site is usable without it.
const doc = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

/* ---------------- 3D tier: decided before any 3D code is requested ---------------- */
export function chooseTier() {
  const forced = new URLSearchParams(location.search).get('tier');
  if (forced === 'static' || forced === 'simplified' || forced === 'enhanced') return { tier: forced, reason: 'forced' };
  if (reduceMotion.matches) return { tier: 'static', reason: 'reduced-motion' };
  const conn = navigator.connection || {};
  if (conn.saveData) return { tier: 'static', reason: 'save-data' };
  if (/(^|slow-)2g|3g/.test(conn.effectiveType || '')) return { tier: 'static', reason: 'slow-network' };
  let gl = null;
  try {
    const c = document.createElement('canvas');
    gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) || c.getContext('webgl', { failIfMajorPerformanceCaveat: true });
  } catch { gl = null; }
  if (!gl) return { tier: 'static', reason: 'no-webgl' };
  // Software renderers (SwiftShader, llvmpipe, etc.) cannot run the scene smoothly.
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name)) { gl.getExtension('WEBGL_lose_context')?.loseContext(); return { tier: 'static', reason: 'software-renderer' }; }
  } catch { /* unknown renderer: carry on */ }
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (mem < 2 || cores < 4) return { tier: 'static', reason: 'low-end-device' };
  const touchFirst = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 768;
  if (touchFirst) return { tier: 'simplified', reason: 'capable-phone' };
  if (mem < 4) return { tier: 'simplified', reason: 'limited-memory' };
  return { tier: 'enhanced', reason: 'desktop' };
}

function initGlobe() {
  const host = document.querySelector('[data-globe]');
  if (!host) return;
  const { tier, reason } = chooseTier();
  host.dataset.tier = tier;
  host.dataset.tierReason = reason;
  if (tier === 'static') return;

  const toggle = host.querySelector('.globe-toggle');
  const start = () => {
    import('./globe/scene.js').then(async ({ mountGlobe }) => {
      let ctl;
      try {
        ctl = await mountGlobe(host, {
          tier,
          noGuard: new URLSearchParams(location.search).get('perfguard') === '0',
          onReady: () => host.classList.add('is-live'),
          onFail: (why) => { host.classList.remove('is-live'); host.dataset.tier = 'static'; host.dataset.tierReason = why; },
        });
      } catch (err) {
        host.dataset.tier = 'static'; host.dataset.tierReason = 'webgl-failed';
        return;
      }
      window.__globe = ctl;
      // Reduced motion can change while the page is open.
      reduceMotion.addEventListener?.('change', (e) => { if (e.matches) { ctl.destroy(); host.classList.remove('is-live'); host.dataset.tier = 'static'; } });
      toggle?.addEventListener('click', () => {
        const next = !ctl.paused;
        ctl.setPaused(next);
        toggle.setAttribute('aria-pressed', String(next));
        toggle.querySelector('[data-label]').textContent = next ? 'Play animation' : 'Pause animation';
        toggle.querySelector('[data-icon="pause"]').toggleAttribute('hidden', next);
        toggle.querySelector('[data-icon="play"]').toggleAttribute('hidden', !next);
      });
    }).catch(() => { host.dataset.tier = 'static'; host.dataset.tierReason = 'load-failed'; });
  };
  // Core content first: wait for load, then an idle moment.
  const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') idle(start);
  else addEventListener('load', () => idle(start), { once: true });
}

/* ---------------- Navigation ---------------- */
function initNav() {
  document.querySelectorAll('.nav-trigger').forEach((btn) => {
    const menu = document.getElementById(btn.getAttribute('aria-controls'));
    const set = (open) => { btn.setAttribute('aria-expanded', String(open)); menu.classList.toggle('is-open', open); };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    const wrap = btn.closest('.has-dropdown');
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); } });
    wrap.addEventListener('focusout', (e) => { if (!wrap.contains(e.relatedTarget)) set(false); });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) set(false); });
    if (finePointer.matches) {
      let t;
      wrap.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { clearTimeout(t); set(true); } });
      wrap.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') t = setTimeout(() => set(false), 160); });
    }
  });

  const toggle = document.querySelector('.menu-toggle');
  const panel = document.getElementById('mobile-menu');
  if (!toggle || !panel) return;
  const main = document.querySelector('main');
  const footer = document.querySelector('.site-footer');
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.visually-hidden').textContent = open ? 'Close menu' : 'Open menu';
    panel.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    [main, footer].forEach((el) => el && (open ? el.setAttribute('inert', '') : el.removeAttribute('inert')));
    if (open) panel.querySelector('a')?.focus({ preventScroll: true });
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setOpen(false); toggle.focus(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('is-open')) { setOpen(false); toggle.focus(); } });
  matchMedia('(min-width: 64em)').addEventListener?.('change', (e) => { if (e.matches) setOpen(false); });
}

/* ---------------- Section entrances ---------------- */
function initReveals() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  els.forEach((el) => {
    // Anything already on screen at load shows at once rather than animating in late.
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * 0.92 && r.bottom > 0) el.classList.add('is-in'); else io.observe(el);
  });
}

/* ---------------- Card tilt (mouse only) ---------------- */
function initTilt() {
  if (!finePointer.matches || reduceMotion.matches) return;
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    let raf = 0;
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { card.style.setProperty('--rx', `${(x * 5).toFixed(2)}deg`); card.style.setProperty('--ry', `${(-y * 5).toFixed(2)}deg`); });
    });
    card.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); card.style.removeProperty('--rx'); card.style.removeProperty('--ry'); });
  });
}

/* ---------------- FAQ: smooth expand and collapse on native <details> ---------------- */
function initFaq() {
  document.querySelectorAll('.faq details').forEach((d) => {
    const summary = d.querySelector('summary');
    const body = d.querySelector('.answer');
    let anim = null;
    summary.addEventListener('click', (e) => {
      if (reduceMotion.matches || !body.animate) return; // native toggle
      e.preventDefault();
      if (anim) anim.cancel();
      if (!d.open) {
        d.open = true;
        const h = body.offsetHeight;
        anim = body.animate([{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' });
        anim.onfinish = () => { anim = null; };
      } else {
        const h = body.offsetHeight;
        d.classList.add('is-closing');
        anim = body.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 240, easing: 'cubic-bezier(.65,0,.35,1)' });
        anim.onfinish = () => { d.open = false; d.classList.remove('is-closing'); anim = null; };
        anim.oncancel = () => d.classList.remove('is-closing');
      }
    });
    body.style.overflow = 'hidden';
  });
}

/* ---------------- Application journey: progressive highlight ---------------- */
function initJourney() {
  const steps = [...document.querySelectorAll('.journey-step')];
  if (!steps.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const idx = steps.indexOf(e.target);
      steps.forEach((s, i) => { s.classList.toggle('is-active', i === idx); s.classList.toggle('is-done', i < idx); });
    });
  }, { rootMargin: '-40% 0px -45% 0px' });
  steps.forEach((s) => io.observe(s));
}

/* ---------------- Filters and search ---------------- */
function initFilters() {
  const form = document.querySelector('[data-filter-form]');
  if (!form) return;
  const region = document.querySelector('[data-results-region]');
  const items = [...document.querySelectorAll('[data-item]')];
  const count = document.querySelector('[data-count]');
  const empty = document.querySelector('[data-empty]');
  const noun = form.dataset.noun || 'results';
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Prefill from the URL (the hero search submits here with GET).
  const params = new URLSearchParams(location.search);
  [...form.elements].forEach((el) => { if (el.name && params.has(el.name)) el.value = params.get(el.name); });

  let timer = 0;
  function apply(animate) {
    const data = new FormData(form);
    const q = norm(data.get('q')).trim();
    const terms = q.split(/\s+/).filter(Boolean);
    let shown = 0;
    items.forEach((el) => {
      let ok = terms.every((t) => norm(el.dataset.search).includes(t));
      for (const [k, v] of data.entries()) {
        if (k === 'q' || !v) continue;
        const have = (el.dataset[k] || '').split('|');
        if (!have.includes(v)) ok = false;
      }
      const wasHidden = el.hidden;
      el.hidden = !ok;
      if (ok) {
        shown++;
        if (animate && wasHidden && !reduceMotion.matches) {
          el.style.setProperty('--i', Math.min(shown, 8));
          el.classList.remove('is-entering'); void el.offsetWidth; el.classList.add('is-entering');
        }
      }
    });
    count.textContent = `${shown} ${shown === 1 ? noun.replace(/s$/, '') : noun} found`;
    if (empty) empty.hidden = shown > 0;
    region.classList.remove('is-loading');
    region.removeAttribute('aria-busy');
  }
  function schedule() {
    region.classList.add('is-loading');
    region.setAttribute('aria-busy', 'true');
    clearTimeout(timer);
    timer = setTimeout(() => {
      apply(true);
      const url = new URL(location.href);
      const data = new FormData(form);
      [...form.elements].forEach((el) => { if (!el.name) return; const v = data.get(el.name); if (v) url.searchParams.set(el.name, v); else url.searchParams.delete(el.name); });
      history.replaceState(null, '', url);
    }, 180);
  }
  form.addEventListener('input', schedule);
  form.addEventListener('change', schedule);
  form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); apply(true); });
  form.addEventListener('reset', () => setTimeout(schedule));
  document.querySelector('[data-clear]')?.addEventListener('click', () => { form.reset(); form.querySelector('input')?.focus(); });
  apply(false);
}

/* ---------------- Course search: official data loaded on demand ---------------- */
function initCourses() {
  const form = document.querySelector('[data-course-search]');
  if (!form) return;
  const region = document.querySelector('[data-results-region]');
  const list = document.querySelector('[data-course-results]');
  const count = document.querySelector('[data-count]');
  const empty = document.querySelector('[data-empty]');
  const more = document.querySelector('[data-more]');
  const failed = document.querySelector('[data-load-error]');
  const PAGE = 24;
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (x) => x.toLocaleString('en-GB');
  const AVAIL = ['', 'optional', 'compulsory'];

  const params = new URLSearchParams(location.search);
  [...form.elements].forEach((el) => {
    if (!el.name || !params.has(el.name)) return;
    if (el.type === 'checkbox') el.checked = params.get(el.name) === el.value; else el.value = params.get(el.name);
  });

  let data = null, matches = [], shown = 0, timer = 0;
  const busy = (on) => { region.classList.toggle('is-loading', on); if (on) region.setAttribute('aria-busy', 'true'); else region.removeAttribute('aria-busy'); };

  function card(c) {
    const [title, ui, subj, length, placement, abroad, campus, duId] = c;
    const [, uname, city, , ukprn] = data.u[ui];
    const tags = subj.slice(0, 2).map((i) => `<li class="tag">${esc(data.s[i])}</li>`);
    if (length) tags.push(`<li class="tag">${esc(length)}</li>`);
    if (placement) tags.push(`<li class="tag tag--royal">Placement year ${AVAIL[placement]}</li>`);
    if (abroad) tags.push(`<li class="tag tag--royal">Year abroad ${AVAIL[abroad]}</li>`);
    const where = [uname, city].filter(Boolean).join(' · ');
    return `<article class="card course-card"><div class="card-body">
      <h3>${esc(title)}</h3>
      <p class="uni-line">${esc(where)}${campus ? ` <span class="visually-hidden">, campus:</span><small>(${esc(campus)})</small>` : ''}</p>
      <ul class="meta">${tags.join('')}</ul>
      <div class="card-foot actions"><a class="btn btn--ghost" href="https://discoveruni.gov.uk/course-details/${ukprn}/${encodeURI(duId)}/" rel="noopener">Course details<span class="visually-hidden"> for ${esc(title)} at ${esc(uname)} on Discover Uni</span></a><a class="btn" href="contact.html?course=${encodeURIComponent(`${title}, ${uname}`)}">Enquire<span class="visually-hidden"> about ${esc(title)} at ${esc(uname)}</span></a></div>
    </div></article>`;
  }

  function renderMore() {
    const next = matches.slice(shown, shown + PAGE);
    list.insertAdjacentHTML('beforeend', next.map(card).join(''));
    shown += next.length;
    more.hidden = shown >= matches.length;
    more.textContent = `Show more courses (${fmt(matches.length - shown)} more)`;
  }

  function apply() {
    const f = new FormData(form);
    const terms = norm(f.get('q')).trim().split(/\s+/).filter(Boolean);
    const subj = f.get('subject') ? data.s.indexOf(f.get('subject')) : -1;
    const uni = f.get('university') ? data.u.findIndex((u) => u[0] === f.get('university')) : -1;
    const nation = f.get('nation') || '';
    const placement = f.get('placement') === '1', abroad = f.get('abroad') === '1';
    matches = [];
    for (let i = 0; i < data.c.length; i++) {
      const c = data.c[i];
      if (uni >= 0 && c[1] !== uni) continue;
      if (subj >= 0 && !c[2].includes(subj)) continue;
      if (nation && data.u[c[1]][3] !== nation) continue;
      if (placement && !c[4]) continue;
      if (abroad && !c[5]) continue;
      if (terms.length && !terms.every((t) => data.idx[i].includes(t))) continue;
      matches.push(c);
    }
    list.innerHTML = '';
    shown = 0;
    renderMore();
    count.textContent = `${fmt(matches.length)} ${matches.length === 1 ? 'course' : 'courses'} found`;
    empty.hidden = matches.length > 0;
    busy(false);
  }

  function schedule() {
    if (!data) return;
    busy(true);
    clearTimeout(timer);
    timer = setTimeout(() => {
      apply();
      const url = new URL(location.href);
      [...form.elements].forEach((el) => {
        if (!el.name) return;
        const v = el.type === 'checkbox' ? (el.checked ? el.value : '') : el.value;
        if (v) url.searchParams.set(el.name, v); else url.searchParams.delete(el.name);
      });
      history.replaceState(null, '', url);
    }, 160);
  }

  form.addEventListener('input', schedule);
  form.addEventListener('change', schedule);
  form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); if (data) apply(); });
  more.addEventListener('click', () => {
    const first = shown;
    renderMore();
    list.children[first]?.querySelector('a')?.focus({ preventScroll: false });
  });
  document.querySelector('[data-clear]')?.addEventListener('click', () => { form.reset(); schedule(); form.querySelector('input')?.focus(); });

  fetch(new URL('data/courses.json', document.baseURI))
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => {
      d.idx = d.c.map((c) => norm(`${c[0]} ${d.u[c[1]][1]} ${d.u[c[1]][2]} ${c[2].map((i) => d.s[i]).join(' ')}`));
      data = d;
      region.classList.remove('is-fetching');
      apply();
    })
    .catch(() => { region.classList.remove('is-fetching'); busy(false); count.textContent = 'Courses could not be loaded'; failed.hidden = false; });
}

/* ---------------- Enquiry form: validation and success state ---------------- */
function initEnquiry() {
  const form = document.querySelector('[data-enquiry]');
  if (!form) return;
  form.noValidate = true;
  const summary = form.querySelector('[data-error-summary]');
  const success = document.querySelector('[data-success]');
  const messages = {
    name: 'Enter your full name',
    email: 'Enter an email address in the correct format, like name@example.com',
    phone: 'Enter a UK phone number, like 07700 900123',
    country: 'Select the country you live in',
    level: 'Select the level you want to study',
    consent: 'Tick the box to let us contact you about your enquiry',
  };
  const fields = [...form.querySelectorAll('[data-validate]')];
  const check = (input) => {
    const wrap = input.closest('.field');
    let valid = input.type === 'checkbox' ? input.checked : input.checkValidity() && input.value.trim() !== '';
    if (!input.required && input.value.trim() === '') valid = true;
    wrap.classList.toggle('is-invalid', !valid);
    input.setAttribute('aria-invalid', String(!valid));
    const err = wrap.querySelector('.error span');
    if (err) err.textContent = messages[input.name] || 'Check this field';
    return valid;
  };
  fields.forEach((f) => {
    f.addEventListener('blur', () => { if (f.value || f.type === 'checkbox') check(f); });
    f.addEventListener('input', () => { if (f.closest('.field').classList.contains('is-invalid')) check(f); });
    f.addEventListener('change', () => { if (f.closest('.field').classList.contains('is-invalid')) check(f); });
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const bad = fields.filter((f) => !check(f));
    if (bad.length) {
      summary.hidden = false;
      summary.querySelector('ul').innerHTML = bad.map((f) => `<li><a href="#${f.id}">${messages[f.name] || 'Check this field'}</a></li>`).join('');
      summary.focus();
      return;
    }
    summary.hidden = true;
    const btn = form.querySelector('[type="submit"]');
    btn.setAttribute('aria-busy', 'true');
    btn.querySelector('[data-label]').textContent = 'Sending…';
    // Not connected to a backend yet: the enquiry is not sent anywhere.
    const data = Object.fromEntries(new FormData(form).entries());
    console.info('[Learn UK] Enquiry captured locally (no backend configured):', data);
    setTimeout(() => {
      form.hidden = true;
      success.hidden = false;
      success.querySelector('[data-first-name]').textContent = String(data.name || '').trim().split(/\s+/)[0] || 'there';
      success.classList.add('is-shown');
      success.querySelector('h2').focus();
    }, 450);
  });
  summary?.addEventListener('click', (e) => {
    const a = e.target.closest('a'); if (!a) return;
    e.preventDefault(); const el = document.querySelector(a.getAttribute('href')); el?.focus(); el?.scrollIntoView({ block: 'center' });
  });
  document.querySelector('[data-reset-enquiry]')?.addEventListener('click', () => {
    form.reset(); form.hidden = false; success.hidden = true; form.querySelector('input')?.focus();
  });
  // Prefill course of interest from a "Enquire" link.
  const p = new URLSearchParams(location.search);
  if (p.get('course')) { const el = form.querySelector('[name="interest"]'); if (el) el.value = p.get('course'); }
}

/* ---------------- Hero lead form: phone and email only ---------------- */
function initLead() {
  const form = document.querySelector('[data-lead]');
  if (!form) return;
  const done = document.querySelector('[data-lead-success]');
  const fields = [...form.querySelectorAll('input')];
  const check = (input) => {
    const ok = input.value.trim() !== '' && input.checkValidity();
    input.closest('.field').classList.toggle('is-invalid', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    return ok;
  };
  fields.forEach((f) => {
    f.addEventListener('blur', () => { if (f.value) check(f); });
    f.addEventListener('input', () => { if (f.closest('.field').classList.contains('is-invalid')) check(f); });
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const bad = fields.filter((f) => !check(f));
    if (bad.length) { bad[0].focus(); return; }
    const btn = form.querySelector('[type="submit"]');
    btn.setAttribute('aria-busy', 'true');
    btn.querySelector('[data-label]').textContent = 'Sending…';
    // Not connected to a backend yet: the lead is not sent anywhere.
    console.info('[Learn UK] Lead captured locally (no backend configured):', Object.fromEntries(new FormData(form).entries()));
    setTimeout(() => { form.hidden = true; done.hidden = false; done.focus(); }, 400);
  });
}

/* ---------------- Boot ---------------- */
window.__lukReady = true;
initNav();
initReveals();
initTilt();
initFaq();
initJourney();
initFilters();
initCourses();
initEnquiry();
initLead();
initGlobe();
