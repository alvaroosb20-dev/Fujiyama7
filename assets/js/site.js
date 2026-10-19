import { loadSettings, loadCarta, loadGallery, price, esc, telHref, waHref, mainPhone } from "./core.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ------------------------------------------------------------------ */
/* Cabecera, menú móvil, navegación activa, animaciones                */
/* ------------------------------------------------------------------ */
const header = $("#header");
const dock = $("#dock");
const onScroll = () => {
  const y = window.scrollY;
  header.classList.toggle("is-solid", y > 40);
  dock.classList.toggle("is-show", y > window.innerHeight * 0.7);
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

const burger = $("#burger");
const mobileMenu = $("#mobile-menu");
function setMenu(open) {
  document.body.classList.toggle("menu-open", open);
  burger.setAttribute("aria-expanded", String(open));
  burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  mobileMenu.setAttribute("aria-hidden", String(!open));
}
burger.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
mobileMenu.addEventListener("click", e => { if (e.target.closest("a")) setMenu(false); });
document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });

const navLinks = $$(".nav a");
const spy = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (en.isIntersecting) navLinks.forEach(a => a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id));
  });
}, { rootMargin: "-45% 0px -50% 0px" });
["carta", "experiencia", "galeria", "nosotros", "contacto"].forEach(id => { const el = document.getElementById(id); if (el) spy.observe(el); });

const revealer = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("is-in"); revealer.unobserve(en.target); } });
}, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
const observeReveals = (root = document) => $$(".reveal:not(.is-in)", root).forEach(el => revealer.observe(el));
observeReveals();

$("#year").textContent = new Date().getFullYear();

/* ------------------------------------------------------------------ */
/* Visor (lightbox) reutilizable                                       */
/* ------------------------------------------------------------------ */
const lb = { el: $("#lb"), stage: $("#lb-stage"), cap: $("#lb-cap"), count: $("#lb-count"), items: [], i: 0, paper: false, lastFocus: null };
function openLightbox(items, index = 0, opts = {}) {
  lb.items = items; lb.i = index; lb.paper = !!opts.paper; lb.lastFocus = document.activeElement;
  lb.el.classList.add("is-open"); lb.el.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderLightbox();
  $("#lb-close").focus();
}
function closeLightbox() {
  lb.el.classList.remove("is-open"); lb.el.setAttribute("aria-hidden", "true");
  lb.stage.innerHTML = ""; document.body.style.overflow = "";
  lb.lastFocus?.focus?.();
}
function renderLightbox() {
  const it = lb.items[lb.i];
  lb.stage.className = "lb__stage" + (lb.paper ? " is-paper" : "");
  lb.stage.innerHTML = "";
  if (it.type === "video") {
    const v = document.createElement("video");
    v.src = it.src; v.controls = true; v.playsInline = true; v.preload = "metadata"; v.autoplay = true;
    if (it.poster) v.poster = it.poster;
    v.setAttribute("aria-label", it.title || "Vídeo");
    lb.stage.append(v);
  } else {
    const img = new Image();
    img.src = it.src; img.alt = it.alt || it.title || ""; img.decoding = "async";
    if (lb.paper) {
      img.className = "lb__zoom";
      img.addEventListener("click", () => {
        const z = img.classList.toggle("is-zoomed");
        lb.stage.classList.toggle("is-scroll", z);
      });
    }
    lb.stage.append(img);
  }
  lb.cap.innerHTML = (it.title ? `<strong>${esc(it.title)}</strong>` : "") + (it.desc ? `<span>${esc(it.desc)}</span>` : "") + (lb.paper ? `<span>Pulsa la página para ampliar</span>` : "");
  lb.count.textContent = lb.items.length > 1 ? `${lb.i + 1} / ${lb.items.length}` : "";
  $("#lb-prev").hidden = $("#lb-next").hidden = lb.items.length < 2;
}
const step = d => { lb.i = (lb.i + d + lb.items.length) % lb.items.length; renderLightbox(); };
$("#lb-close").addEventListener("click", closeLightbox);
$("#lb-prev").addEventListener("click", () => step(-1));
$("#lb-next").addEventListener("click", () => step(1));
lb.el.addEventListener("click", e => { if (e.target === lb.stage) closeLightbox(); });
document.addEventListener("keydown", e => {
  if (!lb.el.classList.contains("is-open")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") step(-1);
  if (e.key === "ArrowRight") step(1);
});
let touchX = null;
lb.stage.addEventListener("touchstart", e => { touchX = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
lb.stage.addEventListener("touchend", e => {
  if (touchX === null || lb.stage.classList.contains("is-scroll")) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50 && lb.items.length > 1) step(dx < 0 ? 1 : -1);
  touchX = null;
});

/* ------------------------------------------------------------------ */
/* Carta                                                               */
/* ------------------------------------------------------------------ */
const CARTA_PAGES = [
  ["01-menu-japones", "Menú japonés"], ["02-entrantes-tempura-usuzukuri", "Entrantes, tempura y usuzukuri"],
  ["03-sashimi-tartar-inari-temaki", "Sashimi, tartar, inari y temaki"], ["04-nigiris-gunkan", "Nigiris y gunkan"],
  ["05-hosomakis-uramakis", "Hosomakis y uramakis"], ["06-futomakis-gohan", "Futomakis y gohan"],
  ["07-postres", "Postres y alérgenos"], ["08-te-sake", "Té japonés y sake"],
  ["09-cervezas-refrescos", "Cervezas, refrescos y café"], ["10-destilados", "Destilados"],
  ["11-licores-espumosos-blancos", "Licores, espumosos y vinos blancos"], ["12-vinos-afrutados-rosados-tintos", "Vinos afrutados, rosados y tintos"]
].map(([f, t]) => ({ type: "image", src: `/assets/carta/${f}.webp`, title: `Carta original · ${t}`, alt: `Página de la carta de Fujiyama: ${t}` }));

function renderCartaPages() {
  const box = $("#carta-pages");
  box.innerHTML = CARTA_PAGES.map((p, i) => `<button type="button" data-page="${i}" aria-label="Ampliar ${esc(p.title)}"><img src="${p.src}" alt="" loading="lazy" width="108" height="144"></button>`).join("");
  box.addEventListener("click", e => { const b = e.target.closest("[data-page]"); if (b) openLightbox(CARTA_PAGES, +b.dataset.page, { paper: true }); });
  $("#open-carta-pages").addEventListener("click", () => openLightbox(CARTA_PAGES, 0, { paper: true }));
}

function dishHTML(it) {
  const meta = [it.origin, it.description].filter(Boolean);
  const descr = meta.length ? `<div class="dish__desc">${it.origin ? `<span style="color:var(--red)">${esc(it.origin)}</span>${it.description ? " · " : ""}` : ""}${esc(it.description)}</div>` : "";
  const img = it.image ? `<img class="dish__img" src="${esc(it.image)}" alt="${esc(it.name)}" loading="lazy" data-dish-img>` : "";
  const search = `${it.code} ${it.name} ${it.description} ${it.origin}`.toLowerCase();
  return `<div class="dish" data-search="${esc(search)}">
    <span class="dish__code">${esc(it.code)}</span>
    <span class="dish__name">${esc(it.name)}</span>
    <span class="dish__price">${price(it.price)}</span>
    ${descr}${img}
  </div>`;
}

function renderCarta({ cats }) {
  // Menú japonés destacado
  const mj = cats.find(c => c.slug === "menu-japones");
  const card = $("#menu-japones-card");
  if (mj && mj.items.length) {
    card.hidden = false;
    $("[data-mj-title]").textContent = mj.name;
    $("[data-mj-list]").innerHTML = mj.items.map(i => `<li>${esc(i.name)}</li>`).join("");
    const m = (mj.note || "").match(/(\d+[.,]?\d*)\s*€/);
    $("[data-mj-price]").textContent = m ? m[1].replace(".", ",") + " €" : (mj.note || "");
  } else card.hidden = true;

  const rest = cats.filter(c => c !== mj);
  const groups = [];
  rest.forEach(c => {
    let g = groups.find(x => x.name === c.group);
    if (!g) groups.push(g = { name: c.group || "Carta", cats: [] });
    g.cats.push(c);
  });

  $("#carta-chips").innerHTML = groups.map((g, i) =>
    `<button class="chip${i === 0 ? " is-active" : ""}" role="tab" aria-selected="${i === 0}" data-group="${i}">${esc(g.name)}</button>`).join("");

  $("#carta-groups").innerHTML = groups.map((g, gi) => `
    <div class="carta-group${gi === 0 ? " is-active" : ""}" data-group="${gi}" role="tabpanel" aria-label="${esc(g.name)}">
      <div class="carta-cats">
        ${g.cats.map(c => `
          <section class="carta-cat" data-cat>
            <h3>${esc(c.name)}</h3>
            ${c.items.length
              ? (c.note ? `<p class="carta-cat__note">${esc(c.note)}</p>` : "") + c.items.map(dishHTML).join("")
              : `<div class="carta-pending">${esc(c.note || "Sección pendiente de completar.")}</div>`}
          </section>`).join("")}
      </div>
    </div>`).join("");

  $("#carta-chips").addEventListener("click", e => {
    const b = e.target.closest("[data-group]"); if (!b) return;
    const q = $("#carta-q"); if (q.value) { q.value = ""; filterCarta(""); }
    $$("#carta-chips .chip").forEach(c => { c.classList.toggle("is-active", c === b); c.setAttribute("aria-selected", String(c === b)); });
    $$(".carta-group").forEach(gp => gp.classList.toggle("is-active", gp.dataset.group === b.dataset.group));
    const top = $("#carta-tools").getBoundingClientRect().top;
    const hh = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 72;
    if (top < hh - 2) window.scrollTo({ top: window.scrollY + top - hh, behavior: "smooth" });
  });

  $("#carta-groups").addEventListener("click", e => {
    const img = e.target.closest("[data-dish-img]");
    if (img) openLightbox([{ type: "image", src: img.src, title: img.alt }]);
  });

  let t;
  $("#carta-q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => filterCarta(e.target.value), 120); });
}

function filterCarta(raw) {
  const q = raw.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const box = $("#carta-groups");
  box.classList.toggle("carta-searching", !!q);
  let any = false;
  $$(".carta-cat", box).forEach(cat => {
    let n = 0;
    $$(".dish", cat).forEach(d => {
      const hit = !q || d.dataset.search.normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q);
      d.classList.toggle("dish--hidden", !hit); if (hit) n++;
    });
    const show = !q || n > 0;
    cat.hidden = !show; if (q && n) any = true;
  });
  $$(".carta-group", box).forEach(g => { g.hidden = q ? !$$(".carta-cat:not([hidden])", g).length : false; });
  $("#carta-empty").style.display = q && !any ? "block" : "none";
}

/* ------------------------------------------------------------------ */
/* Galería                                                             */
/* ------------------------------------------------------------------ */
const DEFAULT_GALLERY = [
  { kind: "image", src: "/assets/img/sushi-uramaki.webp", thumb: "/assets/img/sushi-uramaki-640.webp", title: "Uramaki", description: "", category: "Platos", width: 1078, height: 1323 },
  { kind: "image", src: "/assets/img/plato-sashimi.webp", thumb: "/assets/img/plato-sashimi.webp", title: "Sashimi de salmón", description: "", category: "Platos", width: 568, height: 290 },
  { kind: "image", src: "/assets/img/plato-arroz.webp", thumb: "/assets/img/plato-arroz.webp", title: "Cocina Fujiyama", description: "", category: "Platos", width: 558, height: 1100 }
];
const PAGE = 12;
const gal = { all: [], filtered: [], shown: 0, cat: "Todo" };

function renderGallery(items) {
  gal.all = items && items.length ? items : DEFAULT_GALLERY;
  const cats = ["Todo", ...new Set(gal.all.map(g => g.category).filter(Boolean))];
  const filters = $("#gal-filters");
  filters.innerHTML = cats.length > 2 ? cats.map(c => `<button class="chip${c === "Todo" ? " is-active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("") : "";
  filters.onclick = e => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    $$(".chip", filters).forEach(c => c.classList.toggle("is-active", c === b));
    gal.cat = b.dataset.cat; applyGallery();
  };
  applyGallery();
}
function applyGallery() {
  gal.filtered = gal.cat === "Todo" ? gal.all : gal.all.filter(g => g.category === gal.cat);
  gal.shown = 0; const box = $("#gallery"); box.innerHTML = "";
  box.classList.toggle("is-few", gal.filtered.length < 4); box.style.setProperty("--cols", Math.max(gal.filtered.length, 1));
  moreGallery();
}
function moreGallery() {
  const box = $("#gallery");
  const next = gal.filtered.slice(gal.shown, gal.shown + PAGE);
  next.forEach((g, k) => {
    const idx = gal.shown + k;
    const b = document.createElement("button");
    b.type = "button"; b.className = "tile" + (g.kind === "video" ? " tile--video" : "");
    b.dataset.idx = idx;
    b.setAttribute("aria-label", (g.kind === "video" ? "Reproducir vídeo: " : "Ampliar foto: ") + (g.title || "Fujiyama"));
    const ratio = g.width && g.height ? `style="aspect-ratio:${g.width}/${g.height}"` : "";
    b.innerHTML = (g.thumb
      ? `<img src="${esc(g.thumb)}" alt="${esc(g.title || "Fujiyama")}" loading="lazy" decoding="async" ${ratio}>`
      : `<div class="tile__ph">Vídeo</div>`)
      + (g.kind === "video" ? `<span class="tile__play"><span><svg><use href="#i-play"/></svg></span></span>` : "")
      + (g.title ? `<span class="tile__cap">${esc(g.title)}</span>` : "");
    const im = b.querySelector("img");
    if (im) { if (im.complete) im.classList.add("is-loaded"); else im.addEventListener("load", () => im.classList.add("is-loaded"), { once: true }); }
    box.append(b);
  });
  gal.shown += next.length;
  $("#gal-more").hidden = gal.shown >= gal.filtered.length;
  observeReveals(box);
}
$("#gal-more").addEventListener("click", moreGallery);
$("#gallery").addEventListener("click", e => {
  const t = e.target.closest(".tile"); if (!t) return;
  const items = gal.filtered.map(g => ({ type: g.kind, src: g.src, poster: g.thumb, title: g.title, desc: g.description, alt: g.title }));
  openLightbox(items, +t.dataset.idx);
});

/* ------------------------------------------------------------------ */
/* Datos del restaurante                                               */
/* ------------------------------------------------------------------ */
const fmtPhone = p => { const d = String(p).replace(/\D/g, ""); return d.length === 9 ? d.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4") : p; };
const pend = label => `<span class="pending">${esc(label)} pendiente de configurar</span>`;

function applySettings(s) {
  $$("[data-s]").forEach(el => { const v = s[el.dataset.s]; if (v) el.textContent = v; });

  // Sobre nosotros
  const about = $("#about-text");
  if (s.aboutText) {
    about.innerHTML = s.aboutText.split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join("");
  } else {
    about.innerHTML = `<p class="is-provisional">[Texto provisional] Aquí irá la presentación de Fujiyama: quiénes sois, cómo nació el restaurante y qué propuesta gastronómica ofrecéis.</p>
      <p class="is-provisional">[Texto provisional] Se edita desde el panel de administración, en «Datos del restaurante».</p>
      <div class="about__badge">${pend("Texto «Sobre nosotros»")}</div>`;
  }
  if (s.aboutImage) $("#about-img").src = s.aboutImage;

  // Información de contacto: teléfono general + un bloque por restaurante
  const phone = mainPhone(s);
  const mapsUrl = l => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.mapsQuery || l.address)}`;
  const blocks = [];
  s.locations.forEach((l, i) => {
    const body = `
      <p>${l.address ? esc(l.address) : pend("Dirección")}</p>
      ${l.phone ? `<p style="margin-top:4px"><a href="${telHref(l.phone)}">${esc(fmtPhone(l.phone))}</a></p>` : ""}
      ${l.hours.length
        ? `<table class="hours" style="margin-top:10px">${l.hours.map(h => `<tr${/cerrado/i.test(h.hours) ? ' class="is-closed"' : ""}><td>${esc(h.days)}</td><td>${esc(h.hours).replace(/\s*·\s*/g, "<br>")}</td></tr>`).join("")}</table>`
        : `<p style="margin-top:8px">${pend("Horario")}</p>`}
      ${l.hoursNote ? `<p style="font-size:14px;color:var(--muted);margin-top:8px">${esc(l.hoursNote)}</p>` : ""}
      <div class="info__actions">
        ${l.bookingUrl ? `<a class="btn btn--sm btn--red" href="${esc(l.bookingUrl)}" target="_blank" rel="noopener"><svg><use href="#i-cal"/></svg>Reservar</a>` : ""}
        ${l.phone ? `<a class="btn btn--sm" href="${telHref(l.phone)}"><svg><use href="#i-phone"/></svg>Llamar</a>` : ""}
        ${l.whatsapp ? `<a class="btn btn--sm" href="${waHref(l.whatsapp, `Hola Fujiyama ${l.name}`)}" target="_blank" rel="noopener"><svg><use href="#i-wa"/></svg>WhatsApp</a>` : ""}
        ${l.address ? `<a class="btn btn--sm" target="_blank" rel="noopener" href="${mapsUrl(l)}">Cómo llegar</a><button class="btn btn--sm" type="button" data-map="${i}"><svg><use href="#i-pin"/></svg>Ver mapa</button>` : ""}
      </div>`;
    blocks.push(info("i-pin", "Fujiyama " + esc(l.name), body));
  });
  if (s.email) blocks.push(info("i-mail", "Email", `<p><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>`));
  $("#info-list").innerHTML = blocks.join("");

  // Mapa (se carga al pulsar, sin cookies de terceros hasta entonces)
  const map = $("#map");
  const withAddr = s.locations.map((l, i) => ({ l, i })).filter(x => x.l.address);
  const showMap = i => {
    const l = s.locations[i];
    map.innerHTML = `<iframe title="Mapa de Fujiyama ${esc(l.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(l.mapsQuery || l.address)}&output=embed"></iframe>`
      + (withAddr.length > 1 ? `<div class="map__switch">${withAddr.map(x => `<button type="button" data-map="${x.i}" class="${x.i === i ? "is-active" : ""}">${esc(x.l.name)}</button>`).join("")}</div>` : "");
  };
  if (withAddr.length) {
    map.innerHTML = `<div><div class="info__actions" style="justify-content:center">${withAddr.map(x => `<button class="btn btn--sm" type="button" data-map="${x.i}"><svg><use href="#i-pin"/></svg>Mapa ${esc(x.l.name)}</button>`).join("")}</div><p>Al mostrar el mapa se cargará Google Maps, que puede usar cookies propias.</p></div>`;
  } else map.innerHTML = `<div>${pend("Mapa")}<p>Se mostrará cuando se añada la dirección.</p></div>`;
  $("#contacto").addEventListener("click", e => {
    const b = e.target.closest("[data-map]"); if (!b) return;
    showMap(+b.dataset.map);
    if (!map.contains(b)) map.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // Reservas: un enlace por restaurante; con varios, se elige en una ventana
  setupBooking(s.locations.filter(l => l.bookingUrl));

  // Locales en la portada
  $("#hero-locs").innerHTML = s.locations.map(l => `<span>${esc(l.name)}</span>`).join("");

  // Teléfono e Instagram
  $$("[data-phone-link]").forEach(a => { if (phone) a.href = telHref(phone); else a.hidden = true; });
  $$(".call-card__num").forEach(a => a.textContent = phone ? fmtPhone(phone) : "");
  $$(".header__cta[data-phone-link], .mobile-menu [data-phone-link]").forEach(a => { if (phone) a.lastChild.textContent = "Llamar · " + fmtPhone(phone); });
  $$("[data-ig-link]").forEach(a => { if (s.social.instagram) a.href = s.social.instagram; else a.hidden = true; });
  document.body.classList.add("has-dock");

  // Pie
  const fc = [];
  fc.push(phone ? `<p><a href="${telHref(phone)}">${esc(fmtPhone(phone))}</a></p>` : `<p>${pend("Teléfono")}</p>`);
  if (s.email) fc.push(`<p><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>`);
  s.locations.forEach(l => fc.push(`<p><strong>${esc(l.name)}</strong><br>${l.address ? esc(l.address) : pend("Dirección")}</p>`));
  $("#footer-contact").innerHTML = fc.join("");
  const net = [
    ["instagram", "i-ig", "Instagram"], ["facebook", "i-fb", "Facebook"], ["tiktok", "i-tt", "TikTok"],
    ["tripadvisor", "i-star", "Tripadvisor"], ["google", "i-g", "Google"]
  ].filter(([k]) => s.social[k]);
  $("#socials").innerHTML = net.length
    ? net.map(([k, i, n]) => `<a href="${esc(s.social[k])}" target="_blank" rel="noopener" aria-label="${n}"><svg><use href="#${i}"/></svg></a>`).join("")
    : pend("Redes sociales");

  // Datos estructurados: un Restaurant por local
  try {
    const base = location.origin;
    const same = Object.values(s.social).filter(Boolean);
    const graph = s.locations.map(l => ({
      "@type": "Restaurant", name: `Fujiyama ${l.name} · Cocina japonesa`, servesCuisine: ["Japonesa", "Sushi"],
      url: base + "/", image: base + "/assets/img/og-fujiyama.jpg", logo: base + "/assets/img/logo-fujiyama.jpg",
      hasMenu: base + "/#carta", priceRange: "€€",
      ...(l.phone || s.phone ? { telephone: l.phone || s.phone } : {}),
      ...(s.email ? { email: s.email } : {}),
      ...(l.address ? { address: { "@type": "PostalAddress", streetAddress: l.address, addressRegion: "Santa Cruz de Tenerife", addressCountry: "ES" } } : {}),
      ...(same.length ? { sameAs: same } : {})
    }));
    $("#ld-restaurant").textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  } catch {}

}
function setupBooking(locs) {
  const triggers = $$("[data-book]");
  if (!locs.length) { triggers.forEach(b => b.hidden = true); return; }
  const dlg = $("#book");
  $("#book-list").innerHTML = locs.map(l => `
    <a class="book__opt" href="${esc(l.bookingUrl)}" target="_blank" rel="noopener">
      <span><strong>Fujiyama ${esc(l.name)}</strong>${l.address ? `<small>${esc(l.address)}</small>` : ""}</span>
      <svg><use href="#i-right"/></svg>
    </a>`).join("");
  const close = () => dlg.open && dlg.close();
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-book]");
    if (t) {
      e.preventDefault();
      setMenu(false);
      if (locs.length === 1) window.open(locs[0].bookingUrl, "_blank", "noopener");
      else if (dlg.showModal) dlg.showModal(); else location.hash = "contacto";
      return;
    }
    if (e.target.closest("[data-book-close]") || e.target === dlg || e.target.closest(".book__opt")) close();
  });
}
const info = (icon, title, body) => `<div class="info"><span class="info__ico"><svg><use href="#${icon}"/></svg></span><div><h3>${title}</h3>${body}</div></div>`;

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */
renderCartaPages();
const [settings, carta, gallery] = await Promise.all([loadSettings(), loadCarta(), loadGallery()]);
applySettings(settings);
renderCarta(carta);
renderGallery(gallery);
observeReveals();
