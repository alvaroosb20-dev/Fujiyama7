/* Núcleo compartido entre la web pública y el panel de administración */

export const CFG = window.FUJI_CONFIG || {};
export const BUCKET = CFG.STORAGE_BUCKET || "media";
export const isConfigured = () => !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

const HORARIO = "13:00–16:30 · 19:30–23:30";
export const DEFAULT_LOCATIONS = [
  {
    id: "santa-cruz", name: "Santa Cruz",
    address: "Calle José Murphy, 2, Santa Cruz de Tenerife",
    bookingUrl: "https://bit.ly/47cqVQ2",
    mapsQuery: "", phone: "", whatsapp: "", hoursNote: "",
    hours: [{ days: "Todos los días", hours: HORARIO }]
  },
  {
    id: "la-laguna", name: "La Laguna",
    address: "Plaza de la Concepción, 12, San Cristóbal de La Laguna",
    bookingUrl: "https://bit.ly/47eLyuQ",
    mapsQuery: "", phone: "", whatsapp: "", hoursNote: "",
    hours: [
      { days: "Lunes y martes", hours: HORARIO },
      { days: "Miércoles", hours: "Cerrado" },
      { days: "Jueves a domingo", hours: HORARIO }
    ]
  }
];

export const DEFAULT_SETTINGS = {
  heroSubtitle: "La esencia de la gastronomía japonesa",
  heroText: "Cocina japonesa, sake y té japonés para compartir sin prisa.",
  aboutTitle: "Quiénes somos",
  aboutText: "Fujiyama es cocina japonesa en Tenerife, con dos restaurantes: uno en Santa Cruz, en la calle José Murphy, y otro en La Laguna, en la plaza de la Concepción.\n\nNuestra carta recorre la cocina japonesa de principio a fin: entrantes como el tataki de atún o las gyozas, usuzukuri, sashimi, nigiris, uramakis y futomakis, y platos calientes como el ramen, el okonomiyaki o el pollo teriyaki.\n\nPara acompañar, tés japoneses, sake, cervezas y whiskies japoneses y una selección de vinos, también canarios.",
  aboutImage: "",
  phone: "922 28 77 55", // teléfono general
  whatsapp: "",
  email: "",
  locations: DEFAULT_LOCATIONS,
  social: { instagram: "https://www.instagram.com/fujiyama_restaurante/", facebook: "", tiktok: "", tripadvisor: "", google: "" },
  legal: { owner: "", nif: "", address: "", email: "" }
};

let _sb = null;
export async function sb() {
  if (!isConfigured()) return null;
  if (_sb) return _sb;
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  _sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  return _sb;
}

/* Enlace de reservas: si un local guardado antes no tiene el campo, se usa el de por defecto */
const defaultBooking = l => DEFAULT_LOCATIONS.find(d => d.id === l.id || d.name === l.name)?.bookingUrl || "";
const cleanLoc = (l, i) => ({
  id: l.id || "local-" + (i + 1), name: l.name || `Local ${i + 1}`, address: l.address || "", mapsQuery: l.mapsQuery || "",
  bookingUrl: typeof l.bookingUrl === "string" ? l.bookingUrl.trim() : defaultBooking(l),
  phone: l.phone || "", whatsapp: l.whatsapp || "", hoursNote: l.hoursNote || "",
  hours: Array.isArray(l.hours) ? l.hours.filter(h => h && (h.days || h.hours)) : []
});

export function mergeSettings(data) {
  const d = data || {};
  const locs = Array.isArray(d.locations) && d.locations.length ? d.locations : DEFAULT_LOCATIONS;
  return {
    ...DEFAULT_SETTINGS, ...d,
    locations: locs.map(cleanLoc),
    social: { ...DEFAULT_SETTINGS.social, ...(d.social || {}) },
    legal: { ...DEFAULT_SETTINGS.legal, ...(d.legal || {}) }
  };
}

/* Teléfono para los botones "Llamar": el general o, si no hay, el del primer local que lo tenga */
export const mainPhone = s => s.phone || s.locations.find(l => l.phone)?.phone || "";

export async function loadSettings() {
  try {
    const c = await sb();
    if (!c) return mergeSettings();
    const { data, error } = await c.from("site_settings").select("data").eq("id", 1).maybeSingle();
    if (error) throw error;
    return mergeSettings(data?.data);
  } catch (e) {
    console.warn("[Fujiyama] Ajustes por defecto:", e.message || e);
    return mergeSettings();
  }
}

/* Carta: [{ slug, name, group, note, items:[{code,name,description,origin,price,image}] }] */
export async function loadCarta() {
  const fallback = (window.FUJI_CARTA || []).map(c => ({ ...c, items: c.items.map(i => ({ ...i })) }));
  try {
    const c = await sb();
    if (!c) return { source: "local", cats: fallback };
    const [cats, items] = await Promise.all([
      c.from("menu_categories").select("*").order("position"),
      c.from("menu_items").select("*").order("position")
    ]);
    if (cats.error) throw cats.error;
    if (items.error) throw items.error;
    if (!cats.data.length) return { source: "local", cats: fallback };
    const out = cats.data.filter(x => x.visible !== false).map(cat => ({
      slug: cat.slug, name: cat.name, group: cat.grp, note: cat.note || "",
      items: items.data.filter(i => i.category_id === cat.id && i.visible !== false).map(i => ({
        code: i.code || "", name: i.name, description: i.description || "", origin: i.origin || "",
        price: i.price === null ? null : Number(i.price), image: i.image_path ? publicUrl(i.image_path) : ""
      }))
    }));
    return { source: "db", cats: out };
  } catch (e) {
    console.warn("[Fujiyama] Carta local:", e.message || e);
    return { source: "local", cats: fallback };
  }
}

export async function loadGallery() {
  try {
    const c = await sb();
    if (!c) return null;
    const { data, error } = await c.from("gallery_items").select("*").eq("published", true).order("position").order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(g => ({
      ...g,
      src: publicUrl(g.src_path),
      thumb: g.thumb_path ? publicUrl(g.thumb_path) : (g.kind === "image" ? publicUrl(g.src_path) : "")
    }));
  } catch (e) {
    console.warn("[Fujiyama] Galería no disponible:", e.message || e);
    return null;
  }
}

export function publicUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${CFG.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
export const price = v => (v === null || v === undefined || v === "" || isNaN(v)) ? "" : EUR.format(Number(v));

export const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

export const telHref = p => "tel:" + String(p).replace(/[^\d+]/g, "");
export const waHref = (p, text = "") => {
  let n = String(p).replace(/\D/g, "");
  if (n.length === 9) n = "34" + n; // número español sin prefijo
  return `https://wa.me/${n}${text ? "?text=" + encodeURIComponent(text) : ""}`;
};
