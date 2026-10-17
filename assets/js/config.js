/* =====================================================================
   CONFIGURACIÓN DE FUJIYAMA
   Rellena estos dos valores con los de tu proyecto de Supabase
   (Supabase → Project Settings → API). La "anon key" es pública:
   la seguridad la ponen las políticas RLS de supabase/01_schema.sql.
   Mientras estén vacíos, la web funciona con los datos por defecto
   y el panel /admin muestra un aviso de configuración pendiente.
   ===================================================================== */
window.FUJI_CONFIG = {
  SUPABASE_URL: "",       // ej: "https://abcdxyz.supabase.co"
  SUPABASE_ANON_KEY: "",  // ej: "eyJhbGciOi..."
  STORAGE_BUCKET: "media",
  SITE_URL: "https://www.tudominio.com" // dominio final (SEO, sitemap)
};
