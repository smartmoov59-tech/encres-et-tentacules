/* ==========================================================================
   ENCRES ET TENTACULES — interactions & motion
   GSAP + ScrollTrigger + Flip + Lenis (tout est local, aucun service externe)
   Site statique : la réservation prépare un e-mail (mailto:) et un fichier .ics.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const MAIL = 'contact@encres-et-tentacules.com';
  const PHONE = '09 77 45 84 43';
  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

  if (reduce || !hasGsap) root.classList.add('no-motion');

  /* ------------------------------------------------------------------ *
   *  Tentacule SVG (fil rouge) : corps effilé + ventouses + masque de tracé
   * ------------------------------------------------------------------ */
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;
  const svgEl = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };

  function tentacle(svg, d, o = {}) {
    const id = 't' + (++uid);
    const vb = svg.viewBox.baseVal;
    const probe = svgEl('path', { d });
    const L = probe.getTotalLength();
    const N = o.samples || 200, w0 = o.w0 || 40, w1 = o.w1 || 3, p = o.taper || 1;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, s = L * t;
      const a = probe.getPointAtLength(Math.max(0, s - 0.8)), b = probe.getPointAtLength(Math.min(L, s + 0.8)), c = probe.getPointAtLength(s);
      const dx = b.x - a.x, dy = b.y - a.y, m = Math.hypot(dx, dy) || 1;
      pts.push({ x: c.x, y: c.y, nx: -dy / m, ny: dx / m, w: w1 + (w0 - w1) * Math.pow(1 - t, p), t });
    }
    const f = (v) => v.toFixed(1);
    const left = pts.map((q) => f(q.x + q.nx * q.w / 2) + ',' + f(q.y + q.ny * q.w / 2));
    const right = pts.map((q) => f(q.x - q.nx * q.w / 2) + ',' + f(q.y - q.ny * q.w / 2)).reverse();
    const defs = svgEl('defs');
    const grad = svgEl('linearGradient', { id: id + 'g', x1: 0, y1: 0, x2: 1, y2: 1 });
    [['0', '#f7f0e0'], ['.55', '#e4d8bf'], ['1', '#b9a98a']].forEach(([off, col]) => grad.appendChild(svgEl('stop', { offset: off, 'stop-color': col })));
    const mask = svgEl('mask', { id: id + 'm', maskUnits: 'userSpaceOnUse', x: vb.x - 80, y: vb.y - 80, width: vb.width + 160, height: vb.height + 160 });
    const mp = svgEl('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': w0 * 1.9 + 30, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    mp.style.strokeDasharray = L; mp.style.strokeDashoffset = L;
    mask.appendChild(mp);
    defs.append(grad, mask);
    const g = svgEl('g', { mask: 'url(#' + id + 'm)' });
    g.appendChild(svgEl('path', { d: 'M' + left.join('L') + 'L' + right.join('L') + 'Z', fill: 'url(#' + id + 'g)', stroke: 'rgba(6,7,11,.55)', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }));
    const S = o.suckers || 22;
    for (let k = 0; k < S; k++) {
      const t = 0.045 + 0.9 * Math.pow(k / (S - 1), o.spread || 0.82);
      const q = pts[Math.min(N, Math.round(t * N))];
      const r = Math.max(1.3, q.w * 0.15);
      const side = k % 2 ? -1 : 1;
      const cx = q.x + q.nx * side * q.w * 0.2, cy = q.y + q.ny * side * q.w * 0.2;
      g.appendChild(svgEl('circle', { cx: f(cx), cy: f(cy), r: f(r * 1.4), fill: 'rgba(6,7,11,.38)' }));
      g.appendChild(svgEl('circle', { cx: f(cx), cy: f(cy), r: f(r), fill: '#e23b57' }));
      g.appendChild(svgEl('circle', { cx: f(cx - r * 0.25), cy: f(cy - r * 0.28), r: f(r * 0.36), fill: 'rgba(255,255,255,.42)' }));
    }
    svg.append(defs, g);
    return { mask: mp, L, group: g, draw: (v) => { mp.style.strokeDashoffset = L * (1 - v); } };
  }

  function spiralD(cx, cy, r0, r1, turns, n, start) {
    let d = '';
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = start + t * turns * Math.PI * 2, r = r0 + (r1 - r0) * Math.pow(t, 0.9);
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1);
    }
    return d;
  }

  /* ------------------------------------------------------------------ *
   *  Découpage de texte
   * ------------------------------------------------------------------ */
  function splitChars(node) {
    const txt = node.textContent; node.textContent = '';
    const frag = document.createDocumentFragment();
    Array.from(txt).forEach((ch) => {
      if (ch === ' ') { frag.append(' '); return; }
      const s = document.createElement('span'); s.className = 'char'; s.textContent = ch; frag.append(s);
    });
    node.append(frag);
    return $$('.char', node);
  }

  function wrapWords(el, mode) {
    const out = [];
    const walk = (parent) => {
      Array.from(parent.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            if (mode === 'mask') {
              const wm = document.createElement('span'); wm.className = 'wm';
              wm.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.14em;margin-bottom:-.14em';
              const wi = document.createElement('span'); wi.className = 'wi'; wi.style.display = 'inline-block'; wi.textContent = part;
              wm.append(wi); frag.append(wm); out.push(wi);
            } else {
              const w = document.createElement('span'); w.className = 'w'; w.textContent = part; frag.append(w); out.push(w);
            }
          });
          parent.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          if (n.classList.contains('chip-img')) { n.classList.add('w'); out.push(n); }
          else if (n.tagName !== 'BR') walk(n);
        }
      });
    };
    walk(el);
    return out;
  }

  /* ------------------------------------------------------------------ *
   *  Données de la galerie (photos du salon / de ses artistes)
   * ------------------------------------------------------------------ */
  const G = [
    ['079', 640, 640, 'geek', 'Stitch et son « Ohana » en couleur'],
    ['030', 512, 640, 'floral', 'Chat et pivoines en noir et gris'],
    ['063', 512, 640, 'noir', 'Créature à tentacules, noir et gris'],
    ['007', 597, 640, 'flash', 'Flash Day : les starters Pokémon'],
    ['082', 639, 640, 'geek', 'Harley Quinn en version brique'],
    ['077', 512, 640, 'floral', 'Tournesol et feuillage'],
    ['062', 512, 640, 'noir', 'Deux loups en miroir sur les mollets'],
    ['094', 640, 640, 'geek', 'Héroïne de manga en couleurs'],
    ['016', 512, 640, 'floral', 'Fleurs fines en noir et gris'],
    ['021', 640, 640, 'noir', 'Grandes ailes dessinées dans le dos'],
    ['093', 639, 640, 'geek', 'Le masque de Majora (Zelda)'],
    ['053', 639, 640, 'floral', 'Lettrage fineline « One Life »'],
    ['005', 640, 640, 'noir', 'Médaillon ornemental'],
    ['068', 512, 640, 'geek', 'WALL-E sur l’avant-bras'],
    ['074', 640, 640, 'floral', 'Magnolia sur l’épaule'],
    ['061', 639, 640, 'noir', 'Montre à gousset réaliste'],
    ['057', 480, 640, 'flash', 'Planche de flashs de Sayra'],
    ['073', 640, 640, 'geek', 'Duo de personnages de manga, trait fin'],
    ['099', 639, 640, 'floral', 'Crâne et fleurs en noir et gris'],
    ['071', 512, 640, 'noir', 'Fantôme et tentacules sur la main'],
    ['024', 640, 640, 'geek', 'Sceptre de magical girl, rose et violet'],
    ['001', 640, 640, 'floral', 'Libellule bleue, côté nature'],
    ['083', 512, 640, 'noir', 'Tigre au trait fin'],
    ['055', 480, 640, 'flash', 'Planche de flashs fineline d’Amaury'],
    ['089', 639, 640, 'geek', 'Deadpool et sa licorne gonflable'],
    ['086', 640, 640, 'floral', 'Petit alien sous un dôme étoilé'],
    ['087', 639, 640, 'noir', 'Portrait masqué, noir et gris'],
    ['022', 639, 640, 'geek', 'Pirate version chibi'],
    ['051', 639, 640, 'floral', 'Lys et papillon, trait fin'],
    ['096', 571, 640, 'noir', 'Dague ornementale'],
    ['070', 512, 640, 'geek', 'Personnage de série animée, rouge et noir'],
    ['008', 600, 640, 'flash', 'Flash Day : mangas et mascottes'],
    ['018', 640, 639, 'geek', 'Blason fantasy orange et vert']
  ];
  const CAT = { geek: 'Manga & geek', floral: 'Floral & fineline', noir: 'Noir & gris', flash: 'Flashs' };

  /* ------------------------------------------------------------------ *
   *  Utilitaires UI
   * ------------------------------------------------------------------ */
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }

  let lenis = null;
  const scrollToEl = (target, opts = {}) => {
    if (lenis) lenis.scrollTo(target, Object.assign({ duration: 1.7, easing: (t) => 1 - Math.pow(1 - t, 4), force: true }, opts));
    else if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'smooth' });
    else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ------------------------------------------------------------------ *
   *  Horaires : pastille « ouvert » + jour courant
   * ------------------------------------------------------------------ */
  function initHours() {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    const day = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get('weekday')];
    const mins = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);
    const row = $('#hours tr[data-d="' + day + '"]'); if (row) row.classList.add('is-today');
    const pill = $('#openPill'), txt = $('#openText');
    const weekday = day >= 1 && day <= 5;
    let label;
    if (weekday && mins >= 600 && mins < 1020) label = 'Horaires : ouvert jusqu’à 17 h · sur rendez-vous';
    else {
      pill.classList.add('is-closed');
      if (weekday && mins < 600) label = 'Fermé · ouvre à 10 h · sur rendez-vous';
      else if (day >= 1 && day <= 4) label = 'Fermé · ouvre demain à 10 h';
      else label = 'Fermé · ouvre lundi à 10 h';
    }
    txt.textContent = label;
  }

  /* ------------------------------------------------------------------ *
   *  Menus déroulants sur mesure (le <select> natif reste dans le DOM, caché et synchronisé :
   *  le formulaire, la validation et le message e-mail continuent de le lire)
   * ------------------------------------------------------------------ */
  function initSelects() {
    $$('select.inp').forEach((sel) => {
      const label = document.querySelector('label[for="' + sel.id + '"]');
      if (label && !label.id) label.id = sel.id + '-lbl';
      const wrap = document.createElement('div'); wrap.className = 'dd';
      sel.parentNode.insertBefore(wrap, sel); wrap.append(sel);
      sel.classList.add('dd__native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');

      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'dd__btn inp'; btn.id = sel.id + '-btn';
      btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
      if (label) btn.setAttribute('aria-labelledby', label.id + ' ' + btn.id);
      const val = document.createElement('span'); val.className = 'dd__val';
      btn.append(val);
      btn.insertAdjacentHTML('beforeend', '<svg class="dd__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>');

      const list = document.createElement('ul');
      list.className = 'dd__list'; list.id = sel.id + '-list'; list.setAttribute('role', 'listbox'); list.setAttribute('data-lenis-prevent', '');
      if (label) list.setAttribute('aria-labelledby', label.id);
      btn.setAttribute('aria-controls', list.id);
      const items = Array.from(sel.options).map((o, i) => {
        const li = document.createElement('li'); li.setAttribute('role', 'option'); li.id = sel.id + '-opt' + i; li.textContent = o.textContent; list.append(li); return li;
      });
      wrap.append(btn, list);

      let active = 0, typed = '', typedT;
      const sync = () => {
        const i = sel.selectedIndex < 0 ? 0 : sel.selectedIndex;
        val.textContent = sel.options[i].textContent;
        val.classList.toggle('is-ph', !sel.value);
        items.forEach((li, k) => { li.setAttribute('aria-selected', k === i ? 'true' : 'false'); li.classList.toggle('is-sel', k === i); });
      };
      const setActive = (i) => {
        active = Math.max(0, Math.min(items.length - 1, i));
        items.forEach((li, k) => li.classList.toggle('is-active', k === active));
        btn.setAttribute('aria-activedescendant', items[active].id);
        const li = items[active], top = li.offsetTop, bot = top + li.offsetHeight;
        if (top < list.scrollTop) list.scrollTop = top - 6;
        else if (bot > list.scrollTop + list.clientHeight) list.scrollTop = bot - list.clientHeight + 6;
      };
      const isOpen = () => wrap.classList.contains('is-open');
      const open = () => {
        if (isOpen()) return;
        $$('.dd.is-open').forEach((d) => d.classList.remove('is-open'));
        wrap.classList.remove('dd--up');
        wrap.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true');
        const r = btn.getBoundingClientRect();
        if (r.bottom + list.offsetHeight + 16 > innerHeight && r.top > list.offsetHeight + 16) wrap.classList.add('dd--up');
        setActive(sel.selectedIndex < 0 ? 0 : sel.selectedIndex);
      };
      const close = () => { wrap.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); btn.removeAttribute('aria-activedescendant'); };
      const choose = (i) => {
        sel.selectedIndex = i;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        sync(); close(); btn.focus();
      };

      btn.addEventListener('click', () => (isOpen() ? close() : open()));
      btn.addEventListener('keydown', (e) => {
        const k = e.key;
        if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); if (!isOpen()) open(); else setActive(active + (k === 'ArrowDown' ? 1 : -1)); }
        else if (k === 'Home' || k === 'End') { if (isOpen()) { e.preventDefault(); setActive(k === 'Home' ? 0 : items.length - 1); } }
        else if (k === 'Enter' || k === ' ') { e.preventDefault(); if (isOpen()) choose(active); else open(); }
        else if (k === 'Escape') { if (isOpen()) { e.preventDefault(); e.stopPropagation(); close(); } }
        else if (k === 'Tab') { if (isOpen()) close(); }
        else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          typed += k.toLowerCase(); clearTimeout(typedT); typedT = setTimeout(() => { typed = ''; }, 700);
          const from = (typed.length > 1 ? active : active + 1);
          const order = items.map((_, n) => (from + n) % items.length);
          const hit = order.find((n) => items[n].textContent.toLowerCase().startsWith(typed));
          if (hit !== undefined) { if (!isOpen()) open(); setActive(hit); }
        }
      });
      list.addEventListener('pointermove', (e) => { const li = e.target.closest('li'); if (li) setActive(items.indexOf(li)); });
      list.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) choose(items.indexOf(li)); });
      document.addEventListener('pointerdown', (e) => { if (isOpen() && !wrap.contains(e.target)) close(); });
      sel.addEventListener('change', sync);
      if (label) label.addEventListener('click', (e) => { e.preventDefault(); btn.focus(); });
      sync();
    });
  }

  /* ------------------------------------------------------------------ *
   *  Réservation (formulaire à étapes → e-mail pré-rempli + .ics)
   * ------------------------------------------------------------------ */
  function initBooking() {
    const form = $('#bookForm'); if (!form) return;
    const steps = $$('.fstep', form), bar = $$('#stepsBar button'), done = $('#done');
    let cur = 0, maxReached = 0;
    const picked = [];
    const fmtDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const fromIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const val = (n) => { const e = form.elements[n]; return e ? (e.value || '').trim() : ''; };
    const checked = (n) => $$('[name="' + n + '"]:checked', form).map((e) => e.value);

    function show(n, animate = true) {
      steps.forEach((s, i) => s.classList.toggle('is-on', i === n));
      bar.forEach((b, i) => { b.classList.toggle('is-on', i === n); b.classList.toggle('is-done', i < n); b.toggleAttribute('aria-current', i === n); });
      cur = n; maxReached = Math.max(maxReached, n);
      if (n === 3) updateRecap();
      if (animate && hasGsap && !reduce) gsap.fromTo(steps[n], { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', clearProps: 'transform,opacity' });
      const top = form.getBoundingClientRect().top;
      if (animate && top < 0) scrollToEl(form, { offset: -100, duration: 1 });
    }

    function validate(n) {
      const err = (id, msg) => { const e = $('#' + id); if (e) e.textContent = msg; return !msg; };
      if (n === 1) {
        const needsDesc = !(checked('kind')[0] || '').startsWith('Je ne');
        if (needsDesc && val('desc').length < 5) { err('err1', 'Décrivez votre idée en quelques mots (5 caractères minimum).'); $('#desc').focus(); return false; }
        err('err1', ''); return true;
      }
      if (n === 2) {
        if (!picked.length) { err('err2', 'Choisissez au moins un jour qui vous arrange.'); return false; }
        err('err2', ''); return true;
      }
      if (n === 3) {
        if (!val('fname')) { err('err3', 'Indiquez votre prénom.'); $('#fname').focus(); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) { err('err3', 'Indiquez une adresse e-mail valide pour recevoir la réponse.'); $('#email').focus(); return false; }
        if (!$('#adult').checked) { err('err3', 'Merci de confirmer que vous êtes majeur(e) ou accompagné(e).'); return false; }
        err('err3', ''); return true;
      }
      return true;
    }

    $$('[data-next]', form).forEach((b) => b.addEventListener('click', () => { if (validate(cur)) show(Math.min(3, cur + 1)); }));
    $$('[data-prev]', form).forEach((b) => b.addEventListener('click', () => show(Math.max(0, cur - 1))));
    bar.forEach((b) => b.addEventListener('click', () => {
      const n = +b.dataset.go; if (n > maxReached) return;
      if (n > cur) { for (let i = cur; i < n; i++) if (!validate(i)) return; }
      show(n);
    }));

    /* Calendrier */
    const grid = $('#calGrid'), title = $('#calTitle'), prev = $('#calPrev'), next = $('#calNext'), list = $('#picked');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    let view = new Date(first);
    const lastMonth = new Date(first.getFullYear(), first.getMonth() + 5, 1);

    function renderCal() {
      title.textContent = fmtMonth.format(view);
      prev.disabled = view <= first; next.disabled = view >= lastMonth;
      grid.textContent = '';
      ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].forEach((d) => { const s = document.createElement('div'); s.className = 'cal__dow'; s.textContent = d; s.setAttribute('aria-hidden', 'true'); grid.append(s); });
      const offset = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7;
      for (let i = 0; i < offset; i++) { const e = document.createElement('div'); e.className = 'cal__empty'; grid.append(e); }
      const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const date = new Date(view.getFullYear(), view.getMonth(), d), key = iso(date), dow = date.getDay();
        const b = document.createElement('button'); b.type = 'button'; b.className = 'day'; b.textContent = d;
        b.setAttribute('aria-label', fmtDay.format(date)); b.setAttribute('aria-pressed', picked.includes(key));
        if (date <= today || dow === 0 || dow === 6) b.disabled = true;
        b.addEventListener('click', () => {
          const i = picked.indexOf(key);
          if (i > -1) picked.splice(i, 1);
          else if (picked.length >= 3) { toast('3 jours maximum : retirez-en un d’abord.'); return; }
          else picked.push(key);
          picked.sort(); $('#err2').textContent = ''; renderCal(); renderPicked();
        });
        grid.append(b);
      }
    }
    function renderPicked() {
      list.textContent = '';
      picked.forEach((k) => {
        const li = document.createElement('li'); li.append(fmtDay.format(fromIso(k)) + ' ');
        const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Retirer ' + fmtDay.format(fromIso(k)));
        x.addEventListener('click', () => { picked.splice(picked.indexOf(k), 1); renderCal(); renderPicked(); });
        li.append(x); list.append(li);
      });
    }
    prev.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCal(); });
    next.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(); });
    renderCal();

    /* Message e-mail */
    function build() {
      const name = (val('fname') + ' ' + val('lname')).trim();
      const styles = checked('style');
      const lines = [
        'Bonjour,', '',
        'Je souhaite prendre rendez-vous au salon Encres et Tentacules.', '',
        '• Artiste souhaité(e) : ' + (val('artist') || checked('artist')[0] || 'Peu importe'),
        '• Type de projet : ' + checked('kind')[0],
        '• Style(s) : ' + (styles.length ? styles.join(', ') : 'à définir'),
        '• Emplacement : ' + (val('place') || 'à définir ensemble'),
        '• Taille approximative : ' + (val('size') || 'à définir ensemble'),
        '• Mon idée : ' + (val('desc') || '—'), '',
        'Jours qui m’arrangent :'
      ];
      picked.forEach((k) => lines.push('  - ' + fmtDay.format(fromIso(k))));
      lines.push('Moment de la journée : ' + (checked('when')[0] || 'Peu importe'), '', 'Mes coordonnées :', '• ' + name, '• E-mail : ' + val('email'));
      if (val('tel')) lines.push('• Téléphone : ' + val('tel'));
      lines.push('', 'Je suis majeur(e) ou je viendrai accompagné(e) d’un responsable légal.', '', 'Merci et à bientôt !', '', '(Message préparé depuis le site du salon. Je joins mes images de référence à cet e-mail.)');
      const artist = checked('artist')[0];
      const subject = 'Demande de rendez-vous tatouage – ' + (val('fname') || 'nouveau client') + (artist && artist !== 'Peu importe' ? ' (' + artist + ')' : '');
      return { subject, body: lines.join('\r\n'), text: subject + '\r\n\r\n' + lines.join('\r\n') };
    }
    function updateRecap() {
      const styles = checked('style');
      $('#recap').innerHTML = '';
      const rows = [['Artiste', checked('artist')[0]], ['Projet', checked('kind')[0] + (styles.length ? ' · ' + styles.join(', ') : '')], ['Emplacement', (val('place') || 'à définir') + (val('size') ? ' · ' + val('size') : '')], ['Jours', picked.map((k) => fmtDay.format(fromIso(k))).join(' / ') || '—'], ['Moment', checked('when')[0]]];
      rows.forEach(([k, v]) => { const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = k + ' : '; d.append(b, document.createTextNode(v)); $('#recap').append(d); });
    }

    function mailHref() { const m = build(); return 'mailto:' + MAIL + '?subject=' + encodeURIComponent(m.subject) + '&body=' + encodeURIComponent(m.body); }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      for (let i = 1; i <= 3; i++) if (!validate(i)) { show(i); return; }
      steps.forEach((s) => s.classList.remove('is-on'));
      $('#stepsBar').style.display = 'none';
      done.classList.add('is-on');
      $('#mailAgain').href = mailHref();
      if (hasGsap && !reduce) gsap.fromTo(done, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' });
      const top = form.getBoundingClientRect().top; if (top < 0) scrollToEl(form, { offset: -100, duration: 1 });
      if (!window.__etNoMail) window.location.href = mailHref();
    });
    $('#again').addEventListener('click', () => { done.classList.remove('is-on'); $('#stepsBar').style.display = ''; show(3); });

    $('#copyMsg').addEventListener('click', async () => {
      const t = build().text;
      try { await navigator.clipboard.writeText(t); toast('Message copié, collez-le dans votre e-mail.'); }
      catch (e) {
        const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select();
        try { document.execCommand('copy'); toast('Message copié, collez-le dans votre e-mail.'); } catch (_) { toast('Copie impossible : sélectionnez le texte à la main.'); }
        ta.remove();
      }
    });

    $('#icsBtn').addEventListener('click', () => {
      const when = checked('when')[0] || '';
      const [h1, h2] = when.startsWith('Plutôt l’après') ? ['14', '16'] : ['10', '12'];
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      const esc = (s) => s.replace(/[\\;,]/g, '\\$&').replace(/\r?\n/g, '\\n');
      const ev = picked.map((k, i) => {
        const d = k.replace(/-/g, '');
        return ['BEGIN:VEVENT', 'UID:' + stamp + '-' + i + '@encres-et-tentacules', 'DTSTAMP:' + stamp, 'DTSTART:' + d + 'T' + h1 + '0000', 'DTEND:' + d + 'T' + h2 + '0000',
          'SUMMARY:' + esc('Tatouage · Encres et Tentacules (créneau souhaité, à confirmer)'), 'LOCATION:' + esc('Encres et Tentacules, 564 rue de Paris, 54200 Écrouves'),
          'DESCRIPTION:' + esc('Créneau souhaité, en attente de confirmation par le salon. Contact : ' + MAIL + ' / ' + PHONE), 'STATUS:TENTATIVE', 'END:VEVENT'].join('\r\n');
      });
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Encres et Tentacules//Reservation//FR', 'CALSCALE:GREGORIAN'].concat(ev, ['END:VCALENDAR']).join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' })); a.download = 'rdv-encres-et-tentacules.ics';
      document.body.append(a); a.click(); a.remove(); toast('Fichier agenda téléchargé (créneaux à confirmer).');
    });

    /* Pré-sélection de l'artiste depuis les cartes */
    $$('[data-artist]').forEach((b) => b.addEventListener('click', () => { const r = $('[name="artist"][value="' + b.dataset.artist + '"]'); if (r) r.checked = true; show(0, false); }));
    show(0, false);
  }

  /* ------------------------------------------------------------------ *
   *  FAQ
   * ------------------------------------------------------------------ */
  function initFaq() {
    const items = $$('#faqList .q');
    const setOpen = (q, open, animate = true) => {
      const btn = $('button', q), a = $('.q__a', q);
      q.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', open);
      if (hasGsap && animate && !reduce) gsap.to(a, { height: open ? 'auto' : 0, duration: 0.7, ease: 'expo.out' });
      else a.style.height = open ? 'auto' : '0px';
    };
    items.forEach((q) => $('button', q).addEventListener('click', () => {
      const willOpen = !q.classList.contains('is-open');
      items.forEach((o) => { if (o !== q && o.classList.contains('is-open')) setOpen(o, false); });
      setOpen(q, willOpen);
      if (hasGsap) setTimeout(() => ScrollTrigger.refresh(), 800);
    }));
    setOpen(items[0], true, false);
  }

  /* ------------------------------------------------------------------ *
   *  Galerie : rendu, mise en page en mosaïque, filtres (Flip), lightbox
   * ------------------------------------------------------------------ */
  function initGallery() {
    const grid = $('#grid'); if (!grid) return;
    G.forEach((g, i) => {
      const fig = document.createElement('figure'); fig.className = 'g-item'; fig.dataset.c = g[3]; fig.dataset.i = i;
      fig.innerHTML = '<button class="g-btn" type="button" data-cursor="view" aria-label="Agrandir : ' + g[4] + '"><img src="assets/img/g/' + g[0] + '-s.jpg" alt="Tatouage : ' + g[4] + '" loading="lazy" width="' + g[1] + '" height="' + g[2] + '"><span class="g-cap">' + g[4] + '<br><small style="opacity:.7">' + CAT[g[3]] + '</small></span></button>';
      grid.append(fig);
    });
    const items = $$('.g-item', grid);
    const GAP = () => (innerWidth < 900 ? 10 : 14);
    function layout() {
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length, gap = GAP();
      const colW = (grid.clientWidth - gap * (cols - 1)) / cols;
      grid.style.columnGap = gap + 'px';
      items.forEach((it) => { const g = G[it.dataset.i]; const h = colW * g[2] / g[1]; it.style.setProperty('--sp', Math.ceil((h + gap) / 8)); it.style.setProperty('--gg', gap + 'px'); });
    }
    layout(); addEventListener('resize', layout);

    /* Filtres */
    let filter = 'all';
    $$('#filters .filter').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.f === filter) return;
      filter = b.dataset.f;
      $$('#filters .filter').forEach((x) => x.setAttribute('aria-pressed', x === b));
      const apply = () => items.forEach((it) => it.classList.toggle('is-hidden', !(filter === 'all' || it.dataset.c === filter)));
      if (hasGsap && !reduce && typeof Flip !== 'undefined') {
        const state = Flip.getState(items);
        apply(); layout();
        Flip.from(state, { duration: 0.9, ease: 'power3.inOut', stagger: 0.015, absolute: true, scale: true, onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'expo.out' }), onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.7, duration: 0.45, ease: 'power2.in' }), onComplete: () => ScrollTrigger.refresh() });
      } else { apply(); layout(); }
    }));

    /* Lightbox */
    const lb = $('#lightbox'), img = $('#lbImg'), cap = $('#lbCap');
    let idx = 0, lastFocus = null;
    const visible = () => items.filter((it) => !it.classList.contains('is-hidden'));
    function openLb(i) {
      idx = i; const g = G[i];
      img.src = 'assets/img/g/' + g[0] + '-l.jpg'; img.alt = 'Tatouage : ' + g[4]; cap.textContent = g[4] + ' · ' + CAT[g[3]];
      lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false');
    }
    function stepLb(dir) { const v = visible(); const pos = v.findIndex((it) => +it.dataset.i === idx); const nx = v[(pos + dir + v.length) % v.length]; if (nx) { openLb(+nx.dataset.i); if (hasGsap && !reduce) gsap.fromTo(img, { opacity: 0, x: dir * 40 }, { opacity: 1, x: 0, duration: 0.5, ease: 'expo.out' }); } }
    function closeLb() { lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); if (lenis) lenis.start(); if (lastFocus) lastFocus.focus(); }
    grid.addEventListener('click', (e) => { const b = e.target.closest('.g-btn'); if (!b) return; lastFocus = b; openLb(+b.parentElement.dataset.i); if (lenis) lenis.stop(); $('#lbClose').focus(); });
    $('#lbClose').addEventListener('click', closeLb); $('#lbPrev').addEventListener('click', () => stepLb(-1)); $('#lbNext').addEventListener('click', () => stepLb(1));
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
    addEventListener('keydown', (e) => {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeLb(); else if (e.key === 'ArrowLeft') stepLb(-1); else if (e.key === 'ArrowRight') stepLb(1);
      else if (e.key === 'Tab') { const f = $$('button', lb); const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
    });
  }

  /* ------------------------------------------------------------------ *
   *  Avis : carrousel (défilement natif + glisser + boutons + auto)
   * ------------------------------------------------------------------ */
  function initReviews() {
    const tr = $('#rvTrack'); if (!tr) return;
    const bar = $('#rvBar'), step = () => $('.rv', tr).offsetWidth + 22;
    const upd = () => { const p = (tr.scrollLeft + tr.clientWidth) / tr.scrollWidth; bar.style.transform = 'scaleX(' + Math.min(1, Math.max(0.08, p)) + ')'; };
    tr.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
    const go = (d) => { const end = tr.scrollLeft + tr.clientWidth >= tr.scrollWidth - 8; if (d > 0 && end) tr.scrollTo({ left: 0, behavior: 'smooth' }); else tr.scrollBy({ left: d * step(), behavior: 'smooth' }); };
    $('#rvPrev').addEventListener('click', () => go(-1)); $('#rvNext').addEventListener('click', () => go(1));
    tr.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } });
    let down = false, sx = 0, sl = 0, moved = 0;
    tr.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = 0; sx = e.clientX; sl = tr.scrollLeft; });
    addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - sx; moved = Math.abs(dx); if (moved > 4) tr.classList.add('is-drag'); tr.scrollLeft = sl - dx; });
    addEventListener('pointerup', () => { if (!down) return; down = false; tr.classList.remove('is-drag'); });
    tr.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
    if (!reduce) {
      let hover = false, inView = false;
      tr.addEventListener('pointerenter', () => { hover = true; }); tr.addEventListener('pointerleave', () => { hover = false; });
      tr.addEventListener('focusin', () => { hover = true; }); tr.addEventListener('focusout', () => { hover = false; });
      new IntersectionObserver((en) => { inView = en[0].isIntersecting; }, { threshold: 0.3 }).observe(tr);
      setInterval(() => { if (inView && !hover && !down) go(1); }, 5200);
    }
  }

  /* ------------------------------------------------------------------ *
   *  Animations (GSAP)
   * ------------------------------------------------------------------ */
  function initMotion() {
    gsap.registerPlugin(...[ScrollTrigger, typeof Flip !== 'undefined' ? Flip : null].filter(Boolean));
    let menuOpen = false;

    /* Smooth scroll */
    if (!reduce && typeof Lenis !== 'undefined') {
      lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      lenis.stop();
    }

    const nav = $('#nav'), progress = $('#progress');
    const mm = gsap.matchMedia();
    const desktopMotion = '(min-width: 900px) and (prefers-reduced-motion: no-preference)';

    /* --- Tentacules décoratifs --- */
    const heroT = tentacle($('#heroTentSvg'), 'M 700 940 C 600 820 640 700 540 610 C 440 520 300 560 250 450 C 200 340 300 250 390 290 C 470 325 460 420 390 420 C 340 420 330 360 372 350', { w0: 128, w1: 5, suckers: 30, taper: 0.9, samples: 260 });
    const manT = tentacle($('#manifestoTentSvg'), 'M -40 740 C 120 620 30 500 180 410 C 330 320 490 370 470 230 C 452 110 320 90 296 160 C 272 222 340 258 374 220', { w0: 84, w1: 4, suckers: 24, taper: 0.9 });
    const footT = tentacle($('#footerTentSvg'), 'M 560 740 C 400 620 490 500 340 410 C 190 320 30 370 50 230 C 68 110 200 90 224 160 C 248 222 180 258 146 220', { w0: 84, w1: 4, suckers: 24, taper: 0.9 });
    const procT = tentacle($('#processTentSvg'), 'M 60 -20 C 0 120 120 240 60 380 C 0 520 120 640 60 780 C 20 880 80 940 60 1020', { w0: 34, w1: 10, suckers: 34, taper: 0.35, samples: 240 });

    /* --- Découpe des titres --- */
    const heroChars = [].concat(...$$('.hero__title .split').map(splitChars));
    const footChars = [].concat(...$$('#footerGiant .split').map(splitChars));
    const h2s = $$('.h2').map((h) => ({ h, words: wrapWords(h, 'mask') }));
    const manWords = wrapWords($('#manifestoText'), 'plain');

    /* --- États initiaux de l'intro --- */
    if (!reduce) {
      gsap.set(heroChars, { yPercent: 125 });
      gsap.set('[data-hero-in]', { opacity: 0, y: 36 });
      gsap.set('.hero__actions .btn', { opacity: 0, y: 30 });
      gsap.set('.float', { opacity: 0, scale: 0.5, rotation: -14 });
      gsap.set('#heroMedia', { scale: 1.3 });
      gsap.set(nav, { autoAlpha: 0, y: -30 });
      gsap.set('.hero__scroll', { opacity: 0 });
      gsap.set(footChars, { yPercent: 118 });
      h2s.forEach(({ words }) => gsap.set(words, { yPercent: 118 }));
    }

    /* --- Préchargeur --- */
    const loader = $('#loader');
    const loaderT = tentacle($('#loaderSvg'), spiralD(200, 200, 176, 16, 3.1, 320, Math.PI * 0.9), { w0: 36, w1: 3, suckers: 36, taper: 0.9, samples: 320 });

    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    const winLoaded = new Promise((res) => { if (document.readyState === 'complete') res(); else addEventListener('load', res, { once: true }); });
    const ready = Promise.race([Promise.all([winLoaded, fontsReady]), sleep(3800)]);

    function playIntro() {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.to('#heroMedia', { scale: 1, duration: 2.6, ease: 'power3.out' }, 0)
        .to(nav, { autoAlpha: 1, y: 0, duration: 1.2, clearProps: 'transform' }, 0.5)
        .to(heroChars, { yPercent: 0, duration: 1.4, stagger: { each: 0.045, from: 'start' } }, 0.15)
        .to('[data-hero-in]', { opacity: 1, y: 0, duration: 1.2, stagger: 0.12 }, 0.7)
        .to('.hero__actions .btn', { opacity: 1, y: 0, duration: 1, stagger: 0.12 }, 0.95)
        .to('.float', { opacity: 1, scale: 1, rotation: (i) => [-6, 5, -3][i] || 0, duration: 1.4, stagger: 0.15, ease: 'back.out(1.4)' }, 0.9)
        .to('.hero__scroll', { opacity: 0.8, duration: 1 }, 1.4)
        .add(() => gsap.to({ v: 0 }, { v: 1, duration: 2.4, ease: 'power2.inOut', onUpdate() { heroT.draw(this.targets()[0].v); } }), 0.3);
    }

    function exitLoader() {
      const svg = $('#loaderSvg');
      const tl = gsap.timeline({ onComplete: () => { loader.remove(); if (lenis) lenis.start(); ScrollTrigger.refresh(); } });
      tl.to(['#loaderCount', '.loader__word'], { opacity: 0, duration: 0.35 }, 0)
        .to(svg, { scale: 7, rotation: 80, duration: 1.25, ease: 'power3.in', transformOrigin: '50% 50%' }, 0.1)
        .to(loader, { opacity: 0, duration: 0.6, ease: 'power1.in' }, 0.75)
        .add(playIntro, 0.8);
    }

    if (reduce) {
      loader.remove(); heroT.draw(1); manT.draw(1); footT.draw(1); procT.draw(1);
    } else {
      const prog = { v: 0 }, cnt = $('#loaderCount');
      const setP = () => { cnt.textContent = Math.round(prog.v); loaderT.draw(prog.v / 100); };
      gsap.to(prog, { v: 86, duration: 1.7, ease: 'power2.out', onUpdate: setP });
      Promise.all([ready, sleep(1500)]).then(() => {
        gsap.killTweensOf(prog);
        gsap.to(prog, { v: 100, duration: 0.55, ease: 'power2.inOut', onUpdate: setP, onComplete: exitLoader });
      });
    }

    /* --- Navigation : masquer en descendant, barre de progression --- */
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: (self) => {
        const y = self.scroll();
        nav.classList.toggle('is-solid', y > 60);
        nav.classList.toggle('is-hidden', y > 500 && self.direction === 1 && !menuOpen);
        gsap.set(progress, { scaleX: self.progress });
      }
    });

    /* --- Menu mobile --- */
    const menu = $('#menu'), burger = $('#burger');
    function toggleMenu(open) {
      menuOpen = open; burger.setAttribute('aria-expanded', open); menu.setAttribute('aria-hidden', !open);
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      const r = burger.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, big = Math.hypot(innerWidth, innerHeight) + 40;
      if (open) {
        menu.classList.add('is-open'); if (lenis) lenis.stop();
        gsap.fromTo(menu, { clipPath: 'circle(0px at ' + cx + 'px ' + cy + 'px)' }, { clipPath: 'circle(' + big + 'px at ' + cx + 'px ' + cy + 'px)', duration: 0.9, ease: 'expo.inOut' });
        gsap.fromTo('.menu__links a span', { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: 0.06, ease: 'expo.out', delay: 0.25 });
        gsap.fromTo('.menu__foot > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, delay: 0.6 });
      } else {
        gsap.to(menu, { clipPath: 'circle(0px at ' + cx + 'px ' + cy + 'px)', duration: 0.7, ease: 'expo.inOut', onComplete: () => { menu.classList.remove('is-open'); if (lenis) lenis.start(); } });
      }
    }
    burger.addEventListener('click', () => toggleMenu(!menuOpen));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) toggleMenu(false); });

    /* --- Ancres --- */
    $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href'); if (id === '#') return;
      const t = id === '#top' ? 0 : $(id); if (t === null) return;
      e.preventDefault();
      const go = () => scrollToEl(t, id === '#top' ? {} : { offset: id === '#reserver' ? 0 : 0 });
      if (menuOpen) { toggleMenu(false); setTimeout(go, 500); } else go();
    }));

    /* --- Hero : vidéo, parallax multicouche --- */
    const vid = $('#heroVideo');
    if (reduce || saveData) { vid.removeAttribute('autoplay'); vid.pause(); }
    else {
      vid.addEventListener('loadedmetadata', () => { vid.playbackRate = 0.9; });
      const p = vid.play(); if (p && p.catch) p.catch(() => {});
      new IntersectionObserver((en) => { if (en[0].isIntersecting) { const q = vid.play(); if (q && q.catch) q.catch(() => {}); } else vid.pause(); }, { threshold: 0.05 }).observe($('.hero'));
    }
    if (!reduce) {
      const heroST = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
      gsap.to('#heroMedia', { yPercent: 16, ease: 'none', scrollTrigger: heroST });
      gsap.to('.hero__content', { yPercent: -14, opacity: 0.2, ease: 'none', scrollTrigger: heroST });
      gsap.to('#heroTentacle', { y: -220, ease: 'none', scrollTrigger: heroST });
      $$('.float').forEach((f, i) => {
        gsap.to(f, { y: +f.dataset.speed * 2.2, ease: 'none', scrollTrigger: heroST });
        gsap.to($('img', f), { y: '+=16', rotation: '+=' + (i % 2 ? -2 : 2), duration: 3 + i * 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      });
      if (fine) {
        const layers = [['#heroMedia', 14], ['.hero__floats', -28], ['#heroTentacle', -46]].map(([s, k]) => ({ k, x: gsap.quickTo(s, 'x', { duration: 1.2, ease: 'power3' }), y: gsap.quickTo(s, 'y', { duration: 1.2, ease: 'power3' }) }));
        $('.hero').addEventListener('pointermove', (e) => {
          const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
          layers.forEach((l) => { l.x(nx * l.k); });
        });
      }
    }

    /* --- Marquee réactif au scroll --- */
    const rows = $$('#marquee .marquee__row');
    if (!reduce) {
      rows.forEach((r) => { const base = r.innerHTML; r.innerHTML = base + base + base + base; });
      const state = rows.map((r) => ({ el: r, dir: +r.dataset.dir, x: 0, cycle: 0 }));
      const measure = () => state.forEach((s) => { s.cycle = s.el.scrollWidth / 4; if (s.dir < 0) s.x = -s.cycle; });
      fontsReady.then(measure); addEventListener('resize', measure); measure();
      let boost = 0;
      ScrollTrigger.create({ trigger: '#marquee', start: 'top bottom', end: 'bottom top', onUpdate: (self) => { boost = gsap.utils.clamp(-900, 900, self.getVelocity() / 2.2); } });
      gsap.ticker.add((time, dt) => {
        const s = Math.min(dt, 64) / 1000; boost *= 0.93;
        state.forEach((o) => {
          if (!o.cycle) return;
          o.x -= o.dir * (70 + boost) * s;
          if (o.x <= -o.cycle) o.x += o.cycle; if (o.x > 0) o.x -= o.cycle;
          o.el.style.transform = 'translate3d(' + o.x.toFixed(1) + 'px,0,0)';
        });
      });
    }

    /* --- Titres de sections --- */
    if (!reduce) {
      h2s.forEach(({ h, words }) => ScrollTrigger.create({ trigger: h, start: 'top 88%', once: true, onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.2, stagger: 0.05, ease: 'expo.out' }) }));
      ScrollTrigger.batch('[data-reveal]', { start: 'top 90%', once: true, onEnter: (b) => gsap.fromTo(b, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, stagger: 0.12, ease: 'expo.out', clearProps: 'transform' }) });
      /* Manifeste : mots qui s'allument */
      gsap.to(manWords, { opacity: 1, stagger: 0.12, ease: 'none', scrollTrigger: { trigger: '#manifestoText', start: 'top 82%', end: 'bottom 52%', scrub: true } });
      gsap.to(manT.mask, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.manifesto', start: 'top 70%', end: 'bottom 40%', scrub: 1 } });
      gsap.to('.manifesto__tentacle', { y: -120, ease: 'none', scrollTrigger: { trigger: '.manifesto', start: 'top bottom', end: 'bottom top', scrub: true } });
      /* Pied de page */
      ScrollTrigger.create({ trigger: '#footer', start: 'top 70%', once: true, onEnter: () => { gsap.to(footChars, { yPercent: 0, duration: 1.5, stagger: 0.04, ease: 'expo.out' }); gsap.to({ v: 0 }, { v: 1, duration: 2.6, ease: 'power2.inOut', onUpdate() { footT.draw(this.targets()[0].v); } }); } });
    }

    /* --- Compteurs --- */
    $$('[data-count]').forEach((el) => {
      const end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
      const fmt = (v) => v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      if (reduce) { el.textContent = fmt(end); return; }
      el.textContent = fmt(0);
      const o = { v: 0 };
      ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 2.4, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(o.v); } }) });
    });

    /* --- Méthode : section épinglée --- */
    const dots = $$('.process__dots i');
    mm.add(desktopMotion, () => {
      const steps = $$('#procSteps .step'), frames = $$('.proc__img'), n = steps.length;
      gsap.set(steps.slice(1), { autoAlpha: 0, y: 60 });
      gsap.set(frames.slice(1), { clipPath: 'circle(0% at 50% 100%)', willChange: 'clip-path' });
      gsap.set(frames.slice(1).map((f) => $('img', f)), { scale: 1.08 });
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: '#methode', start: 'top top', end: '+=' + n * 85 + '%', pin: true, scrub: 0.7, anticipatePin: 1, onUpdate: (self) => { const i = Math.min(n - 1, Math.floor(self.progress * n * 0.999)); dots.forEach((d, k) => d.classList.toggle('is-on', k === i)); } }
      });
      for (let i = 1; i < n; i++) {
        tl.to(steps[i - 1], { autoAlpha: 0, y: -60, duration: 0.45, ease: 'power2.in' }, i - 0.3)
          .to(steps[i], { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out' }, i - 0.05)
          .to(frames[i], { clipPath: 'circle(135% at 50% 100%)', duration: 0.9, ease: 'power2.inOut' }, i - 0.45)
          .to($('img', frames[i]), { scale: 1, duration: 1.1 }, i - 0.45)
          /* une fois la nouvelle photo révélée, la précédente disparaît (formats différents : elle déborderait sinon) */
          .set(frames[i - 1], { autoAlpha: 0 }, i + 0.5);
      }
      tl.to({}, { duration: 0.6 });
      tl.to(procT.mask, { strokeDashoffset: 0, duration: tl.duration(), ease: 'none' }, 0);
      return () => { dots.forEach((d, k) => d.classList.toggle('is-on', k === 0)); };
    });
    mm.add('(max-width: 899px), (prefers-reduced-motion: reduce)', () => {
      if (reduce) return;
      $$('#procSteps .step').forEach((s) => gsap.from(s, { y: 60, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 85%', once: true } }));
    });

    /* --- Univers : défilement horizontal piloté par le scroll vertical --- */
    mm.add(desktopMotion, () => {
      const track = $('#univTrack'), stage = $('#univStage');
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      const tween = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: stage, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true } });
      $$('.panel__img img', track).forEach((im) => gsap.fromTo(im, { xPercent: -5 }, { xPercent: 5, ease: 'none', scrollTrigger: { trigger: im.closest('.panel'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } }));
      $$('.panel__txt', track).forEach((tx) => gsap.from(tx, { opacity: 0, y: 40, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: tx.parentElement, containerAnimation: tween, start: 'left 85%', once: true } }));
    });

    /* --- Artistes / galerie : révélations + inclinaisons 3D --- */
    if (!reduce) {
      ScrollTrigger.batch('.g-item', { start: 'top 94%', once: true, onEnter: (b) => gsap.fromTo(b, { y: 70, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 1.1, stagger: 0.07, ease: 'expo.out', clearProps: 'transform,opacity' }) });
      ScrollTrigger.batch('.rv', { start: 'top 92%', once: true, onEnter: (b) => gsap.fromTo(b, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, stagger: 0.1, ease: 'expo.out', clearProps: 'transform,opacity' }) });
      $$('.artist__sheet').forEach((s) => gsap.fromTo(s, { clipPath: 'inset(0 0 100% 0)', y: 60 }, { clipPath: 'inset(0 0 0% 0)', y: 0, duration: 1.4, ease: 'expo.out', clearProps: 'clipPath', scrollTrigger: { trigger: s, start: 'top 85%', once: true } }));
      $$('.stat').forEach((s) => gsap.fromTo($('.stat__n', s), { yPercent: 40 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: s, start: 'top bottom', end: 'top 40%', scrub: true } }));
      $$('.bar i').forEach((b) => gsap.fromTo(b, { '--s': 0 }, { '--s': 1, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: b, start: 'top 92%', once: true } }));
    }
    if (fine && !reduce) {
      const tilt = (el, max, glare) => {
        const gl = glare ? $('.glare', el) : null;
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          gsap.to(el, { rotationY: (px - 0.5) * max * 2, rotationX: -(py - 0.5) * max * 2, transformPerspective: 900, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
          if (gl) { gl.style.background = 'radial-gradient(circle at ' + px * 100 + '% ' + py * 100 + '%, rgba(255,255,255,.75), transparent 55%)'; gsap.to(gl, { opacity: 0.55, duration: 0.3, overwrite: 'auto' }); }
        });
        el.addEventListener('pointerleave', () => { gsap.to(el, { rotationX: 0, rotationY: 0, duration: 0.9, ease: 'elastic.out(1,.5)', overwrite: 'auto' }); if (gl) gsap.to(gl, { opacity: 0, duration: 0.5 }); });
      };
      $$('.tilt').forEach((t) => tilt(t, 9, true));
      $$('.g-btn').forEach((t) => tilt(t, 5, false));

      /* Boutons magnétiques */
      $$('.magnetic').forEach((b) => {
        const inner = $('span', b);
        const xTo = gsap.quickTo(b, 'x', { duration: 0.6, ease: 'power3' }), yTo = gsap.quickTo(b, 'y', { duration: 0.6, ease: 'power3' });
        b.addEventListener('pointermove', (e) => {
          const r = b.getBoundingClientRect(), mx = e.clientX - (r.left + r.width / 2), my = e.clientY - (r.top + r.height / 2);
          xTo(mx * 0.3); yTo(my * 0.4); gsap.to(inner, { x: mx * 0.12, y: my * 0.18, duration: 0.4, overwrite: 'auto' });
        });
        b.addEventListener('pointerleave', () => { xTo(0); yTo(0); gsap.to(inner, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1,.4)' }); });
      });

      /* Curseur */
      root.classList.add('has-cursor');
      const cur = $('#cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring');
      const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'none' }), dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'none' });
      const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
      addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); });
      document.addEventListener('pointerover', (e) => {
        const t = e.target.closest ? e.target.closest('a, button, [data-cursor], label.opt, input, select, textarea') : null;
        cur.classList.toggle('is-view', !!(t && t.dataset && t.dataset.cursor === 'view'));
        cur.classList.toggle('is-link', !!t && !(t.dataset && t.dataset.cursor === 'view'));
      });
    }

    /* --- CTA flottant mobile --- */
    const fab = $('#fab'), book = $('#reserver'), foot = $('#footer');
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: () => { const r = book.getBoundingClientRect(); const inBook = r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.4; const inFoot = foot.getBoundingClientRect().top < innerHeight * 0.55; fab.classList.toggle('is-on', scrollY > innerHeight * 0.7 && !inBook && !inFoot); } });

    /* --- Rafraîchissement une fois tout chargé --- */
    fontsReady.then(() => ScrollTrigger.refresh());
    winLoaded.then(() => setTimeout(() => ScrollTrigger.refresh(), 300));
    addEventListener('resize', () => ScrollTrigger.refresh());
  }

  /* ------------------------------------------------------------------ *
   *  Démarrage
   * ------------------------------------------------------------------ */
  initHours();
  initSelects();
  initBooking();
  initFaq();
  initGallery();
  initReviews();
  if (hasGsap) {
    try { initMotion(); }
    catch (err) { console.error(err); root.classList.add('no-motion'); const l = $('#loader'); if (l) l.remove(); if (lenis) lenis.start(); }
  } else { const l = $('#loader'); if (l) l.remove(); }
})();
