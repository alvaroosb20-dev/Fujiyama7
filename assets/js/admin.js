import { isConfigured, sb, BUCKET, publicUrl, mergeSettings, price, esc } from "./core.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const show = id => ["v-setup", "v-login", "v-recover", "v-app"].forEach(v => $("#" + v).hidden = v !== id);

let client = null;
const CATEGORIES = ["Platos", "Local", "Eventos", "Experiencias"];
const VIDEO_MAX = 50 * 1024 * 1024;

/* ---------------- Utilidades ---------------- */
let toastT;
function toast(msg, err = false) {
  const t = $("#toast"); t.textContent = msg; t.classList.toggle("is-err", err); t.classList.add("is-show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-show"), err ? 6000 : 2800);
}
const setStatus = (el, html, ok = false) => { el.innerHTML = html; el.classList.toggle("is-show", !!html); el.classList.toggle("is-ok", ok); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const errMsg = e => (e && (e.message || e.error_description || e.error)) || String(e);
function check({ error }, what) { if (error) throw new Error(`${what}: ${errMsg(error)}`); }

/* Diálogo genérico: fields = [{name,label,type,value,options,required,placeholder,full}] */
function dialog(title, fields, { okText = "Guardar", onOk } = {}) {
  return new Promise(resolve => {
    const dlg = $("#dlg");
    $("#dlg-title").textContent = title;
    $("#dlg-ok").textContent = okText;
    setStatus($("#dlg-status"), "");
    $("#dlg-body").innerHTML = fields.map(f => {
      const id = "d-" + f.name;
      const req = f.required ? "required" : "";
      let input;
      if (f.type === "textarea") input = `<textarea id="${id}" name="${f.name}" rows="3" ${req} placeholder="${esc(f.placeholder || "")}">${esc(f.value ?? "")}</textarea>`;
      else if (f.type === "select") input = `<select id="${id}" name="${f.name}">${f.options.map(o => `<option ${o === f.value ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
      else if (f.type === "datalist") input = `<input id="${id}" name="${f.name}" list="${id}-l" value="${esc(f.value ?? "")}" ${req}><datalist id="${id}-l">${f.options.map(o => `<option value="${esc(o)}">`).join("")}</datalist>`;
      else if (f.type === "file") input = `<input id="${id}" name="${f.name}" type="file" accept="${f.accept || ""}">`;
      else if (f.type === "info") return `<p class="a-muted a-small" style="margin:0">${f.label}</p>`;
      else input = `<input id="${id}" name="${f.name}" type="${f.type || "text"}" value="${esc(f.value ?? "")}" ${req} ${f.step ? `step="${f.step}"` : ""} placeholder="${esc(f.placeholder || "")}">`;
      return `<div class="field"><label for="${id}">${esc(f.label)}</label>${input}</div>`;
    }).join("");
    const form = $("#dlg-form");
    const onSubmit = async e => {
      if (e.submitter?.value !== "ok") return;
      e.preventDefault();
      if (!form.reportValidity()) return;
      const data = {};
      fields.forEach(f => { if (f.type === "file") data[f.name] = form.elements[f.name]?.files?.[0] || null; else if (f.type !== "info") data[f.name] = form.elements[f.name].value.trim(); });
      const ok = $("#dlg-ok"); ok.disabled = true; ok.innerHTML = `<span class="a-spin"></span>`;
      try {
        if (onOk) await onOk(data);
        cleanup(); dlg.close(); resolve(data);
      } catch (err) {
        setStatus($("#dlg-status"), esc(errMsg(err)));
      } finally { ok.disabled = false; ok.textContent = okText; }
    };
    const onClose = () => { cleanup(); resolve(null); };
    function cleanup() { form.removeEventListener("submit", onSubmit); dlg.removeEventListener("close", onClose); }
    form.addEventListener("submit", onSubmit);
    dlg.addEventListener("close", onClose);
    dlg.showModal();
  });
}

/* ---------------- Procesado de imágenes y vídeo ---------------- */
async function decodeImage(file) {
  try { return await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode(); return img;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
}
function drawToBlob(src, maxSide, quality) {
  const w0 = src.videoWidth || src.naturalWidth || src.width, h0 = src.videoHeight || src.naturalHeight || src.height;
  if (!w0 || !h0) return Promise.reject(new Error("Dimensiones no disponibles"));
  const k = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.round(w0 * k), h = Math.round(h0 * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(src, 0, 0, w, h);
  return new Promise((res, rej) => c.toBlob(b => {
    if (b && b.type === "image/webp") return res({ blob: b, w, h, ext: "webp", type: "image/webp" });
    c.toBlob(j => j ? res({ blob: j, w, h, ext: "jpg", type: "image/jpeg" }) : rej(new Error("No se pudo procesar la imagen")), "image/jpeg", quality);
  }, "image/webp", quality));
}
async function processImage(file) {
  const bmp = await decodeImage(file).catch(() => { throw new Error("Formato de imagen no compatible con este navegador. Prueba con JPG o PNG."); });
  const full = await drawToBlob(bmp, 2200, 0.84);
  const thumb = await drawToBlob(bmp, 720, 0.78);
  return { full, thumb, width: full.w, height: full.h };
}
function videoPoster(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    const fail = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer el vídeo en este navegador (usa MP4/H.264).")); };
    v.addEventListener("error", fail, { once: true });
    v.addEventListener("loadedmetadata", () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); }, { once: true });
    v.addEventListener("seeked", async () => {
      try {
        const r = await drawToBlob(v, 900, 0.8);
        URL.revokeObjectURL(url);
        resolve({ poster: r, width: v.videoWidth, height: v.videoHeight, duration: v.duration });
      } catch (e) { fail(); }
    }, { once: true });
    setTimeout(() => reject(new Error("El vídeo tarda demasiado en procesarse")), 20000);
  });
}
async function upload(path, blob, type) {
  const r = await client.storage.from(BUCKET).upload(path, blob, { contentType: type, cacheControl: "31536000", upsert: false });
  check(r, "Subida");
  return path;
}
async function removeFiles(paths) {
  const p = paths.filter(x => x && !/^https?:/.test(x));
  if (p.length) await client.storage.from(BUCKET).remove(p);
}
const folder = () => { const d = new Date(); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`; };

/* ================================================================== */
/* ARRANQUE Y ACCESO                                                   */
/* ================================================================== */
async function start() {
  if (!isConfigured()) return show("v-setup");
  try { client = await sb(); }
  catch (e) { show("v-setup"); toast("No se pudo cargar Supabase: " + errMsg(e), true); return; }

  client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") show("v-recover");
  });
  const { data: { session } } = await client.auth.getSession();
  if (location.hash.includes("type=recovery")) return show("v-recover");
  if (session) await enter(); else await showLogin();
}

async function showLogin() {
  show("v-login");
  const { data: hasAdmin, error } = await client.rpc("has_admin");
  $("#first-admin").hidden = !!error || hasAdmin !== false;
  if (error) setStatus($("#login-status"), "La base de datos de Fujiyama aún no está preparada (falta ejecutar supabase/01_schema.sql). Las subidas no funcionarán hasta entonces.");
}

$("#signup-form").addEventListener("submit", async e => {
  e.preventDefault();
  const st = $("#signup-status"); setStatus(st, "");
  const { data, error } = await client.auth.signUp({
    email: $("#s-email").value.trim(), password: $("#s-pass").value,
    options: { emailRedirectTo: location.origin + "/admin/" }
  });
  if (error) return setStatus(st, esc(error.message));
  if (data.session) return enter();
  setStatus(st, "Cuenta creada. Te hemos enviado un email: pulsa el enlace para confirmarla y después entra aquí con tu email y contraseña.", true);
});

$("#login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const st = $("#login-status"); setStatus(st, "");
  const { error } = await client.auth.signInWithPassword({ email: $("#l-email").value.trim(), password: $("#l-pass").value });
  if (error) return setStatus(st, error.message === "Invalid login credentials" ? "Email o contraseña incorrectos." : esc(error.message));
  await enter();
});
$("#forgot").addEventListener("click", async () => {
  const email = $("#l-email").value.trim();
  const st = $("#login-status");
  if (!email) return setStatus(st, "Escribe tu email arriba y vuelve a pulsar.");
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/admin/" });
  setStatus(st, error ? esc(error.message) : "Si el email existe, recibirás un enlace para crear una nueva contraseña.", !error);
});
$("#recover-form").addEventListener("submit", async e => {
  e.preventDefault();
  const { error } = await client.auth.updateUser({ password: $("#r-pass").value });
  if (error) return setStatus($("#recover-status"), esc(error.message));
  history.replaceState(null, "", "/admin/");
  toast("Contraseña actualizada"); await enter();
});
$("#logout").addEventListener("click", async () => { await client.auth.signOut(); location.reload(); });

async function enter() {
  // claim_admin: si aún no hay administrador, esta cuenta pasa a serlo; si no, solo comprueba permisos
  let { data: isAdmin, error } = await client.rpc("claim_admin");
  if (error && /claim_admin/.test(error.message || "")) ({ data: isAdmin, error } = await client.rpc("is_admin"));
  if (error || !isAdmin) {
    await client.auth.signOut();
    await showLogin();
    setStatus($("#login-status"), error ? "Error comprobando permisos: " + esc(error.message) + ". ¿Has ejecutado supabase/01_schema.sql?" : "Este usuario no tiene permisos de administrador.");
    return;
  }
  show("v-app"); $("#logout").hidden = false;
  loadGalleryAdmin(); loadCartaAdmin(); loadSettingsAdmin();
}

/* Pestañas */
$$(".a-tabs button").forEach(b => b.addEventListener("click", () => {
  $$(".a-tabs button").forEach(x => x.classList.toggle("is-active", x === b));
  $$(".a-panel").forEach(p => p.classList.toggle("is-active", p.dataset.panel === b.dataset.tab));
}));

/* ================================================================== */
/* GALERÍA                                                             */
/* ================================================================== */
let gItems = [];
let queue = [];

async function loadGalleryAdmin() {
  const r = await client.from("gallery_items").select("*").order("position").order("created_at", { ascending: false });
  if (r.error) return toast("Error cargando galería: " + r.error.message, true);
  gItems = r.data; renderGList();
}
function renderGList() {
  $("#g-count").textContent = `(${gItems.length})`;
  const box = $("#g-list");
  if (!gItems.length) { box.innerHTML = `<div class="a-empty" style="grid-column:1/-1">Aún no hay contenido. Mientras tanto, la web muestra las fotos iniciales.</div>`; return; }
  box.innerHTML = gItems.map((g, i) => {
    const th = g.thumb_path ? publicUrl(g.thumb_path) : (g.kind === "image" ? publicUrl(g.src_path) : "");
    return `<div class="a-gitem${g.published ? "" : " is-off"}" data-id="${g.id}">
      <div class="a-gitem__img">${th ? `<img src="${esc(th)}" alt="" loading="lazy">` : ""}${g.kind === "video" ? "<i>Vídeo</i>" : ""}</div>
      <div style="min-width:0">
        <h3>${esc(g.title || "(sin título)")}</h3>
        <p>${esc(g.category)} · ${new Date(g.created_at).toLocaleDateString("es-ES")}</p>
        <div class="a-icons">
          <button class="a-ib" data-act="top" title="Mover al principio" ${i === 0 ? "disabled" : ""}>⤒</button>
          <button class="a-ib" data-act="up" title="Subir" ${i === 0 ? "disabled" : ""}>↑</button>
          <button class="a-ib" data-act="down" title="Bajar" ${i === gItems.length - 1 ? "disabled" : ""}>↓</button>
          <button class="a-ib" data-act="edit">Editar</button>
          <button class="a-ib a-ib--red" data-act="del" title="Eliminar">Eliminar</button>
        </div>
        <label class="a-switch" style="margin-top:8px"><input type="checkbox" data-act="pub" ${g.published ? "checked" : ""}> Visible en la web</label>
      </div>
    </div>`;
  }).join("");
}

$("#g-list").addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b || b.dataset.act === "pub") return;
  const id = b.closest("[data-id]").dataset.id;
  const i = gItems.findIndex(g => g.id === id); const g = gItems[i];
  try {
    if (b.dataset.act === "up" || b.dataset.act === "down") {
      const j = b.dataset.act === "up" ? i - 1 : i + 1;
      [gItems[i], gItems[j]] = [gItems[j], gItems[i]];
      await persistOrder();
    } else if (b.dataset.act === "top") {
      gItems.splice(i, 1); gItems.unshift(g); await persistOrder();
    } else if (b.dataset.act === "del") {
      if (!confirm(`¿Eliminar «${g.title || "este elemento"}» de la galería? No se puede deshacer.`)) return;
      check(await client.from("gallery_items").delete().eq("id", id), "Eliminar");
      await removeFiles([g.src_path, g.thumb_path]);
      gItems.splice(i, 1); renderGList(); toast("Eliminado");
    } else if (b.dataset.act === "edit") {
      await editGalleryItem(g);
    }
  } catch (err) { toast(errMsg(err), true); loadGalleryAdmin(); }
});
$("#g-list").addEventListener("change", async e => {
  if (e.target.dataset.act !== "pub") return;
  const id = e.target.closest("[data-id]").dataset.id;
  const r = await client.from("gallery_items").update({ published: e.target.checked }).eq("id", id);
  if (r.error) { toast(r.error.message, true); e.target.checked = !e.target.checked; return; }
  gItems.find(g => g.id === id).published = e.target.checked; renderGList();
  toast(e.target.checked ? "Visible en la web" : "Oculto en la web");
});

async function persistOrder() {
  renderGList();
  const changes = gItems.map((g, idx) => ({ g, idx })).filter(({ g, idx }) => g.position !== idx);
  await Promise.all(changes.map(({ g, idx }) => client.from("gallery_items").update({ position: idx }).eq("id", g.id).then(r => { check(r, "Orden"); g.position = idx; })));
  toast("Orden guardado");
}

async function editGalleryItem(g) {
  await dialog("Editar publicación", [
    { name: "title", label: "Título", value: g.title || "" },
    { name: "description", label: "Descripción", type: "textarea", value: g.description || "" },
    { name: "category", label: "Categoría", type: "datalist", options: catOptions(), value: g.category, required: true },
    { name: "file", label: g.kind === "video" ? "Sustituir vídeo (opcional)" : "Sustituir foto (opcional)", type: "file", accept: g.kind === "video" ? "video/mp4,video/webm,video/quicktime" : "image/*" }
  ], {
    onOk: async d => {
      const patch = { title: d.title || null, description: d.description || null, category: d.category || "Platos" };
      const old = [];
      if (d.file) {
        const prepared = await prepareFile(d.file, g.kind);
        Object.assign(patch, await uploadPrepared(prepared));
        old.push(g.src_path, g.thumb_path);
      }
      check(await client.from("gallery_items").update(patch).eq("id", g.id), "Guardar");
      if (old.length) await removeFiles(old);
      Object.assign(g, patch); renderGList(); toast("Cambios guardados");
    }
  });
}
const catOptions = () => [...new Set([...CATEGORIES, ...gItems.map(g => g.category)])];

/* Cola de subida */
const drop = $("#drop");
["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("is-over"); }));
["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove("is-over")));
drop.addEventListener("drop", e => { e.preventDefault(); addToQueue([...e.dataTransfer.files]); });
$("#file-input").addEventListener("change", e => { addToQueue([...e.target.files]); e.target.value = ""; });

function addToQueue(files) {
  files.forEach(file => {
    const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name) ? "image" : null;
    if (!kind) return toast(`«${file.name}» no es una foto ni un vídeo`, true);
    if (kind === "video" && file.size > VIDEO_MAX) return toast(`«${file.name}» pesa ${(file.size / 1048576).toFixed(0)} MB. Máximo 50 MB: comprímelo antes (p. ej. exportar a 1080p).`, true);
    queue.push({ id: uid(), file, kind, title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), description: "", category: "Platos", url: URL.createObjectURL(file), state: "" });
  });
  renderQueue();
}
function renderQueue() {
  $("#queue-actions").hidden = !queue.length;
  $("#upload-all").textContent = `Publicar ${queue.length} ${queue.length === 1 ? "archivo" : "archivos"}`;
  $("#queue").innerHTML = queue.map(q => `
    <div class="a-qitem" data-q="${q.id}">
      ${q.kind === "video" ? `<video src="${q.url}" muted playsinline preload="metadata"></video>` : `<img src="${q.url}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'a-qph'}))">`}
      <div class="form-grid">
        <input class="a-mini" data-f="title" value="${esc(q.title)}" placeholder="Título" aria-label="Título">
        <input class="a-mini" data-f="category" value="${esc(q.category)}" list="cat-list" placeholder="Categoría" aria-label="Categoría">
        <input class="a-mini" data-f="description" value="${esc(q.description)}" placeholder="Descripción (opcional)" aria-label="Descripción">
        <div class="a-row" style="grid-column:1/-1"><span class="a-qstate" data-state>${q.state || (q.kind === "video" ? "Vídeo · " : "Foto · ") + (q.file.size / 1048576).toFixed(1) + " MB"}</span>
        <button class="a-ib a-ib--red" data-rm style="margin-left:auto">Quitar</button></div>
      </div>
    </div>`).join("") + `<datalist id="cat-list">${catOptions().map(c => `<option value="${esc(c)}">`).join("")}</datalist>`;
}
$("#queue").addEventListener("input", e => {
  const f = e.target.dataset.f; if (!f) return;
  const q = queue.find(x => x.id === e.target.closest("[data-q]").dataset.q); q[f] = e.target.value;
});
$("#queue").addEventListener("click", e => {
  if (!e.target.closest("[data-rm]")) return;
  const id = e.target.closest("[data-q]").dataset.q;
  const q = queue.find(x => x.id === id); URL.revokeObjectURL(q.url);
  queue = queue.filter(x => x.id !== id); renderQueue();
});
$("#clear-queue").addEventListener("click", () => { queue.forEach(q => URL.revokeObjectURL(q.url)); queue = []; renderQueue(); });

async function prepareFile(file, kind) {
  if (kind === "image") {
    const p = await processImage(file);
    return { kind, main: { blob: p.full.blob, ext: p.full.ext, type: p.full.type }, thumb: { blob: p.thumb.blob, ext: p.thumb.ext, type: p.thumb.type }, width: p.width, height: p.height };
  }
  if (file.size > VIDEO_MAX) throw new Error("El vídeo supera 50 MB");
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  let v = null;
  try { v = await videoPoster(file); } catch (e) { console.warn("Sin portada:", e); } // se sube igualmente, sin portada
  return { kind, main: { blob: file, ext, type: file.type || "video/mp4" }, thumb: v ? { blob: v.poster.blob, ext: v.poster.ext, type: v.poster.type } : null, width: v?.width || null, height: v?.height || null };
}
async function uploadPrepared(p) {
  const base = `gallery/${folder()}/${uid()}`;
  const src_path = await upload(`${base}.${p.main.ext}`, p.main.blob, p.main.type);
  let thumb_path = null;
  if (p.thumb) {
    try { thumb_path = await upload(`${base}-thumb.${p.thumb.ext}`, p.thumb.blob, p.thumb.type); }
    catch (e) { await removeFiles([src_path]); throw e; }
  }
  return { src_path, thumb_path, width: p.width, height: p.height };
}

$("#upload-all").addEventListener("click", async () => {
  const btn = $("#upload-all"); btn.disabled = true;
  let ok = 0;
  let top = gItems.length ? Math.min(...gItems.map(g => g.position)) : 0;
  for (const q of [...queue].reverse()) { // el primero de la cola queda el primero en la web
    const el = $(`[data-q="${q.id}"] [data-state]`);
    const set = (t, cls = "") => { q.state = t; if (el) { el.innerHTML = t; el.className = "a-qstate " + cls; } };
    try {
      set(`<span class="a-spin"></span> ${q.kind === "image" ? "Optimizando foto…" : "Preparando vídeo…"}`);
      const prepared = await prepareFile(q.file, q.kind);
      set(`<span class="a-spin"></span> Subiendo…`);
      const files = await uploadPrepared(prepared);
      const row = { kind: q.kind, title: q.title.trim() || null, description: q.description.trim() || null, category: q.category.trim() || "Platos", position: --top, published: true, ...files };
      const r = await client.from("gallery_items").insert(row).select().single();
      if (r.error) { await removeFiles([files.src_path, files.thumb_path]); throw r.error; }
      gItems.unshift(r.data); set("✓ Publicado", "is-ok"); ok++;
      URL.revokeObjectURL(q.url); queue = queue.filter(x => x !== q);
    } catch (e) { set("✗ " + esc(errMsg(e)), "is-err"); }
  }
  btn.disabled = false;
  renderGList(); renderQueue();
  if (ok) toast(`${ok} ${ok === 1 ? "elemento publicado" : "elementos publicados"} en la galería`);
});

/* ================================================================== */
/* CARTA                                                               */
/* ================================================================== */
let cats = [], items = [];
const GROUPS = ["Entrantes", "Sashimi y nigiri", "Makis", "Gohan y postres", "Té y sake", "Cervezas y refrescos", "Vinos y espumosos", "Destilados y licores"];

async function loadCartaAdmin() {
  const [c, i] = await Promise.all([
    client.from("menu_categories").select("*").order("position"),
    client.from("menu_items").select("*").order("position")
  ]);
  if (c.error || i.error) return toast("Error cargando la carta: " + (c.error || i.error).message, true);
  cats = c.data; items = i.data; renderCarta();
}
const openCats = new Set();
function renderCarta() {
  $("#c-empty").hidden = cats.length > 0;
  $("#c-list").innerHTML = cats.map((c, ci) => {
    const its = items.filter(x => x.category_id === c.id);
    return `<details class="a-cat${c.visible ? "" : " is-off"}" data-cat="${c.id}" ${openCats.has(c.id) ? "open" : ""}>
      <summary>
        <h3>${esc(c.name)} <small>· ${esc(c.grp)} · ${its.length}</small></h3>
        <div class="a-icons">
          <button class="a-ib" data-act="cup" ${ci === 0 ? "disabled" : ""} title="Subir sección">↑</button>
          <button class="a-ib" data-act="cdown" ${ci === cats.length - 1 ? "disabled" : ""} title="Bajar sección">↓</button>
          <button class="a-ib" data-act="cedit">Editar</button>
          <button class="a-ib a-ib--red" data-act="cdel">Eliminar</button>
        </div>
        <label class="a-switch"><input type="checkbox" data-act="cvis" ${c.visible ? "checked" : ""}> Visible</label>
      </summary>
      <div class="a-cat__body">
        ${c.note ? `<p class="a-muted a-small" style="margin:0 0 8px">Nota: ${esc(c.note)}</p>` : ""}
        ${its.map((it, ii) => `
          <div class="a-item${it.visible ? "" : " is-off"}" data-item="${it.id}">
            <div class="a-item__main">
              <b>${it.code ? `<span style="display:inline;color:var(--muted)">${esc(it.code)} · </span>` : ""}${esc(it.name)}</b><span class="a-item__price" style="display:inline">${price(it.price)}</span>
              ${it.origin || it.description ? `<span>${esc([it.origin, it.description].filter(Boolean).join(" · "))}</span>` : ""}
            </div>
            <div class="a-icons">
              ${it.image_path ? `<img src="${esc(publicUrl(it.image_path))}" alt="" style="width:34px;height:34px;object-fit:cover">` : ""}
              <button class="a-ib" data-act="iup" ${ii === 0 ? "disabled" : ""}>↑</button>
              <button class="a-ib" data-act="idown" ${ii === its.length - 1 ? "disabled" : ""}>↓</button>
              <button class="a-ib" data-act="iedit">Editar</button>
              <button class="a-ib" data-act="ivis">${it.visible ? "Ocultar" : "Mostrar"}</button>
              <button class="a-ib a-ib--red" data-act="idel">✕</button>
            </div>
          </div>`).join("")}
        <div class="a-row" style="margin-top:10px"><button class="btn btn--sm" data-act="iadd">+ Añadir producto</button></div>
      </div>
    </details>`;
  }).join("");
}
$("#c-list").addEventListener("toggle", e => { const d = e.target; if (d.dataset?.cat) d.open ? openCats.add(d.dataset.cat) : openCats.delete(d.dataset.cat); }, true);

$("#c-list").addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b || b.dataset.act === "cvis") return;
  if (b.closest("summary") && b.tagName === "BUTTON") e.preventDefault();
  const catEl = b.closest("[data-cat]"); const c = cats.find(x => x.id === catEl.dataset.cat);
  const itEl = b.closest("[data-item]"); const it = itEl && items.find(x => x.id === itEl.dataset.item);
  try {
    switch (b.dataset.act) {
      case "cup": case "cdown": {
        const i = cats.indexOf(c), j = b.dataset.act === "cup" ? i - 1 : i + 1;
        [cats[i], cats[j]] = [cats[j], cats[i]]; await reorder("menu_categories", cats); break;
      }
      case "cedit": await editCategory(c); break;
      case "cdel": {
        const n = items.filter(x => x.category_id === c.id).length;
        if (!confirm(`¿Eliminar la sección «${c.name}»${n ? ` y sus ${n} productos` : ""}? No se puede deshacer.`)) return;
        check(await client.from("menu_categories").delete().eq("id", c.id), "Eliminar");
        await removeFiles(items.filter(x => x.category_id === c.id).map(x => x.image_path));
        cats = cats.filter(x => x !== c); items = items.filter(x => x.category_id !== c.id); renderCarta(); toast("Sección eliminada"); break;
      }
      case "iadd": openCats.add(c.id); await editItem(null, c); break;
      case "iedit": await editItem(it, c); break;
      case "ivis":
        check(await client.from("menu_items").update({ visible: !it.visible }).eq("id", it.id), "Guardar");
        it.visible = !it.visible; renderCarta(); toast(it.visible ? "Producto visible" : "Producto oculto"); break;
      case "idel":
        if (!confirm(`¿Eliminar «${it.name}» de la carta?`)) return;
        check(await client.from("menu_items").delete().eq("id", it.id), "Eliminar");
        await removeFiles([it.image_path]);
        items = items.filter(x => x !== it); renderCarta(); toast("Producto eliminado"); break;
      case "iup": case "idown": {
        const list = items.filter(x => x.category_id === c.id);
        const i = list.indexOf(it), j = b.dataset.act === "iup" ? i - 1 : i + 1;
        [list[i], list[j]] = [list[j], list[i]];
        await reorder("menu_items", list);
        items = [...items.filter(x => x.category_id !== c.id), ...list]; renderCarta(); break;
      }
    }
  } catch (err) { toast(errMsg(err), true); loadCartaAdmin(); }
});
$("#c-list").addEventListener("change", async e => {
  if (e.target.dataset.act !== "cvis") return;
  const c = cats.find(x => x.id === e.target.closest("[data-cat]").dataset.cat);
  const r = await client.from("menu_categories").update({ visible: e.target.checked }).eq("id", c.id);
  if (r.error) return toast(r.error.message, true);
  c.visible = e.target.checked; renderCarta();
});

async function reorder(table, list) {
  renderCarta();
  await Promise.all(list.map((x, idx) => x.position === idx ? null : client.from(table).update({ position: idx }).eq("id", x.id).then(r => { check(r, "Orden"); x.position = idx; })));
  toast("Orden guardado");
}
const slugify = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "seccion";

async function editCategory(c) {
  await dialog(c ? "Editar sección" : "Nueva sección", [
    { name: "name", label: "Nombre", value: c?.name || "", required: true },
    { name: "grp", label: "Grupo (pestaña de la carta)", type: "datalist", options: [...new Set([...GROUPS, ...cats.map(x => x.grp)])], value: c?.grp || "Entrantes", required: true },
    { name: "note", label: "Nota (opcional)", value: c?.note || "", placeholder: "Ej.: Menú completo · 70 €" },
    { name: "x", type: "info", label: "Si una sección no tiene productos y tiene nota, la web la muestra como aviso." }
  ], {
    onOk: async d => {
      const row = { name: d.name, grp: d.grp, note: d.note || null };
      if (c) {
        check(await client.from("menu_categories").update(row).eq("id", c.id), "Guardar"); Object.assign(c, row);
      } else {
        let slug = slugify(d.name); if (cats.some(x => x.slug === slug)) slug += "-" + Date.now().toString(36);
        const r = await client.from("menu_categories").insert({ ...row, slug, position: cats.length }).select().single();
        check(r, "Crear"); cats.push(r.data); openCats.add(r.data.id);
      }
      renderCarta(); toast("Sección guardada");
    }
  });
}
$("#add-cat").addEventListener("click", () => editCategory(null));

async function editItem(it, c) {
  await dialog(it ? "Editar producto" : `Nuevo producto · ${c.name}`, [
    { name: "code", label: "Nº en la carta (opcional)", value: it?.code || "" },
    { name: "name", label: "Nombre", value: it?.name || "", required: true },
    { name: "price", label: "Precio en € (vacío = sin precio)", type: "text", value: it?.price ?? "", placeholder: "Ej.: 7,50" },
    { name: "origin", label: "Etiqueta (D.O., «Con teína», etc.)", value: it?.origin || "" },
    { name: "description", label: "Descripción", type: "textarea", value: it?.description || "" },
    { name: "image", label: it?.image_path ? "Sustituir foto del plato" : "Foto del plato (opcional)", type: "file", accept: "image/*" }
  ], {
    onOk: async d => {
      const p = d.price.replace(/\s|€/g, "").replace(",", ".");
      if (p && isNaN(+p)) throw new Error("El precio debe ser un número, por ejemplo 7,50");
      const row = { code: d.code || null, name: d.name, price: p ? +(+p).toFixed(2) : null, origin: d.origin || null, description: d.description || null };
      let oldImg = null;
      if (d.image) {
        const pr = await processImage(d.image);
        row.image_path = await upload(`carta/${uid()}.${pr.thumb.ext}`, pr.thumb.blob, pr.thumb.type);
        oldImg = it?.image_path;
      }
      if (it) {
        check(await client.from("menu_items").update(row).eq("id", it.id), "Guardar"); Object.assign(it, row);
      } else {
        const pos = items.filter(x => x.category_id === c.id).length;
        const r = await client.from("menu_items").insert({ ...row, category_id: c.id, position: pos }).select().single();
        check(r, "Crear"); items.push(r.data);
      }
      if (oldImg) await removeFiles([oldImg]);
      renderCarta(); toast("Producto guardado");
    }
  });
}

$("#import-carta").addEventListener("click", async () => {
  const src = window.FUJI_CARTA || [];
  if (!src.length) return toast("No se encuentra la carta inicial", true);
  const btn = $("#import-carta"); btn.disabled = true; btn.innerHTML = `<span class="a-spin"></span> Importando…`;
  try {
    for (const [ci, c] of src.entries()) {
      const r = await client.from("menu_categories").insert({ slug: c.slug, name: c.name, grp: c.group, note: c.note || null, position: ci }).select().single();
      check(r, "Importar");
      if (c.items.length) check(await client.from("menu_items").insert(c.items.map((i, ii) => ({
        category_id: r.data.id, code: i.code || null, name: i.name, description: i.description || null, origin: i.origin || null, price: i.price, position: ii
      }))), "Importar");
    }
    toast("Carta importada"); await loadCartaAdmin();
  } catch (e) { toast(errMsg(e), true); await loadCartaAdmin(); }
  finally { btn.disabled = false; btn.textContent = "Importar la carta inicial (transcrita de la carta original)"; }
});

/* ================================================================== */
/* DATOS DEL RESTAURANTE                                               */
/* ================================================================== */
let settingsData = null;
async function loadSettingsAdmin() {
  const r = await client.from("site_settings").select("data").eq("id", 1).maybeSingle();
  if (r.error) return toast("Error cargando datos: " + r.error.message, true);
  settingsData = mergeSettings(r.data?.data);
  const f = $("#settings-form");
  $$("[name]", f).forEach(el => {
    const [a, b] = el.name.split(".");
    el.value = (b ? settingsData[a]?.[b] : settingsData[a]) ?? "";
  });
  renderLocations(settingsData.locations);
  aboutPreview();
}

/* Restaurantes (locales) */
const hourRow = h => `<div class="a-hour"><input data-h="days" value="${esc(h.days)}" placeholder="Días (ej.: Jueves a domingo)"><input data-h="hours" value="${esc(h.hours)}" placeholder="Horas o «Cerrado»"><button type="button" class="a-ib a-ib--red" data-rmh aria-label="Quitar fila">✕</button></div>`;
function renderLocations(locs) {
  $("#locations").innerHTML = locs.map((l, i) => `
    <div class="a-loc" data-loc="${esc(l.id || "")}">
      <div class="a-loc__head"><strong>${esc(l.name || "Nuevo restaurante")}</strong><button type="button" class="a-ib a-ib--red" data-rmloc>Quitar restaurante</button></div>
      <div class="form-grid form-grid--2">
        <label>Nombre<input data-l="name" value="${esc(l.name)}" required placeholder="Ej.: Santa Cruz"></label>
        <label>Dirección<input data-l="address" value="${esc(l.address)}"></label>
        <label>Teléfono<input data-l="phone" value="${esc(l.phone)}" placeholder="922 000 000"></label>
        <label>WhatsApp<input data-l="whatsapp" value="${esc(l.whatsapp)}"></label>
        <label style="grid-column:1/-1">Búsqueda en Google Maps (opcional)<input data-l="mapsQuery" value="${esc(l.mapsQuery)}" placeholder="Si el mapa no encuentra bien la dirección"></label>
      </div>
      <div><label style="margin-bottom:6px">Horario</label><div class="a-hours">${(l.hours.length ? l.hours : [{ days: "", hours: "" }]).map(hourRow).join("")}</div>
      <button type="button" class="btn btn--sm" data-addh style="margin-top:8px">+ Fila de horario</button></div>
      <label>Nota de horario (opcional)<input data-l="hoursNote" value="${esc(l.hoursNote)}" placeholder="Ej.: cerrado por vacaciones del 1 al 15"></label>
    </div>`).join("");
}
function readLocations() {
  return $$(".a-loc").map((el, i) => {
    const v = k => $(`[data-l=${k}]`, el).value.trim();
    const name = v("name") || `Local ${i + 1}`;
    return {
      id: el.dataset.loc || name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"),
      name, address: v("address"), phone: v("phone"), whatsapp: v("whatsapp"), mapsQuery: v("mapsQuery"), hoursNote: v("hoursNote"),
      hours: $$(".a-hour", el).map(r => ({ days: $("[data-h=days]", r).value.trim(), hours: $("[data-h=hours]", r).value.trim() })).filter(h => h.days || h.hours)
    };
  });
}
$("#locations").addEventListener("click", e => {
  if (e.target.closest("[data-rmh]")) e.target.closest(".a-hour").remove();
  else if (e.target.closest("[data-addh]")) e.target.closest(".a-loc").querySelector(".a-hours").insertAdjacentHTML("beforeend", hourRow({ days: "", hours: "" }));
  else if (e.target.closest("[data-rmloc]")) {
    const n = $("[data-l=name]", e.target.closest(".a-loc")).value || "este restaurante";
    if (confirm(`¿Quitar ${n}? Se aplicará al pulsar «Guardar cambios».`)) e.target.closest(".a-loc").remove();
  }
});
$("#locations").addEventListener("input", e => {
  if (e.target.dataset.l === "name") e.target.closest(".a-loc").querySelector(".a-loc__head strong").textContent = e.target.value || "Nuevo restaurante";
});
$("#add-loc").addEventListener("click", () => renderLocations([...readLocations(), { id: "", name: "", address: "", phone: "", whatsapp: "", mapsQuery: "", hoursNote: "", hours: [] }]));

function aboutPreview() {
  const v = $("#settings-form").aboutImage.value;
  $("#about-prev").hidden = !v; $("#about-clear").hidden = !v; if (v) $("#about-prev").src = v;
}
$("#about-file").addEventListener("change", async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    toast("Subiendo foto…");
    const p = await processImage(file);
    const path = await upload(`site/${uid()}.${p.full.ext}`, p.full.blob, p.full.type);
    $("#settings-form").aboutImage.value = publicUrl(path); aboutPreview();
    toast("Foto lista. Pulsa «Guardar cambios» para publicarla.");
  } catch (err) { toast(errMsg(err), true); }
  e.target.value = "";
});
$("#about-clear").addEventListener("click", () => { $("#settings-form").aboutImage.value = ""; aboutPreview(); });

$("#settings-form").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target; if (!f.reportValidity()) return;
  const data = mergeSettings(settingsData);
  $$("[name]", f).forEach(el => {
    const [a, b] = el.name.split(".");
    if (b) data[a][b] = el.value.trim(); else data[a] = el.value.trim();
  });
  data.locations = readLocations();
  delete data.hours; delete data.address; delete data.mapsQuery; delete data.hoursNote;
  const st = $("#settings-status");
  const r = await client.from("site_settings").update({ data, updated_at: new Date().toISOString() }).eq("id", 1);
  if (r.error) return setStatus(st, "No se pudo guardar: " + esc(r.error.message));
  settingsData = data;
  setStatus(st, "Guardado. Los cambios ya están en la web.", true);
  setTimeout(() => setStatus(st, ""), 4000);
});

start();
