import { loadSettings, esc } from "./core.js";
document.getElementById("year").textContent = new Date().getFullYear();
const labels = { owner: "Titular", nif: "NIF/CIF", address: "Domicilio", email: "Email" };
const s = await loadSettings();
document.querySelectorAll("[data-legal]").forEach(el => {
  const k = el.dataset.legal; const v = s.legal[k] || (k === "email" ? s.email : "");
  el.innerHTML = v ? esc(v) : `<span class="pending">Pendiente</span>`;
});
