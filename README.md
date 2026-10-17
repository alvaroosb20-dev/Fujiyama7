# Fujiyama · Cocina japonesa — Web

Web del restaurante con carta digital, galería de fotos y vídeos gestionable, formulario de reservas y panel privado de administración.

- **Web pública:** HTML + CSS + JavaScript, sin paso de compilación. Se publica tal cual en Vercel, Netlify o cualquier hosting estático.
- **Contenido dinámico:** [Supabase](https://supabase.com) (base de datos, almacenamiento de fotos/vídeos y login del panel). Plan gratuito suficiente para empezar.
- **Panel privado:** `/admin/` — galería, carta, datos del restaurante y mensajes/reservas. Los cambios se ven en la web al instante, sin volver a publicar.

---

## 1. Estructura

```
index.html              Web (portada, carta, experiencia, galería, nosotros, contacto)
admin/index.html        Panel privado
aviso-legal.html · privacidad.html · cookies.html
assets/css/             styles.css (web) · admin.css (panel)
assets/js/config.js     ← AQUÍ van las claves de Supabase
assets/js/carta-data.js Carta por defecto (transcrita de la carta original)
assets/js/core.js       Conexión con Supabase y utilidades
assets/js/site.js       Lógica de la web
assets/js/admin.js      Lógica del panel
assets/img/             Logo (original y versión con fondo transparente), iconos, fotos
assets/carta/           Páginas de la carta original + carta-fujiyama.pdf
supabase/               Scripts SQL (esquema, carta inicial, crear administrador)
vercel.json · robots.txt · sitemap.xml
```

## 2. Conectar Supabase (15 minutos, una sola vez)

1. Crea una cuenta y un proyecto en **supabase.com** (región: *West EU*). Guarda la contraseña de la base de datos.
2. **SQL Editor → New query**: pega el contenido de `supabase/01_schema.sql` y pulsa **Run**. Crea las tablas, las reglas de seguridad y el almacenamiento `media`.
3. (Opcional) Ejecuta `supabase/02_carta_inicial.sql` para cargar la carta. También puedes hacerlo desde el panel con el botón **Importar la carta inicial**.
4. **Authentication → Users → Add user → Create new user**: tu email y una contraseña, marcando *Auto Confirm User*.
5. Abre `supabase/03_crear_admin.sql`, cambia `TU_EMAIL@ejemplo.com` por ese email y ejecútalo. Solo los usuarios de esta lista pueden modificar contenido.
6. **Authentication → URL Configuration**: en *Site URL* pon tu dominio (p. ej. `https://www.fujiyama.es`) y añade `https://www.fujiyama.es/admin/` en *Redirect URLs* (para recuperar la contraseña).
7. **Project Settings → API**: copia *Project URL* y la clave *anon public* en `assets/js/config.js`:

```js
window.FUJI_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
  STORAGE_BUCKET: "media",
  SITE_URL: "https://www.fujiyama.es"
};
```

> La clave *anon* es pública por diseño. Lo que protege los datos son las políticas RLS de `01_schema.sql`: cualquiera puede **leer** la carta, la galería publicada y los datos del restaurante, y **enviar** un formulario; solo los administradores pueden **leer mensajes, subir, editar o borrar**. Nunca pongas la clave *service_role* en la web.

**Mientras `config.js` esté vacío**, la web funciona con la carta y las fotos por defecto, el panel muestra "Configuración pendiente" y el formulario aparece desactivado y marcado como pendiente (no simula envíos).

## 3. Publicar en Vercel

1. Sube esta carpeta a un repositorio de GitHub.
2. En vercel.com → **Add New → Project** → importa el repositorio. *Framework Preset: Other*. Sin comando de build ni carpeta de salida (raíz). **Deploy**.
3. Conecta el dominio en *Settings → Domains*.
4. Busca y reemplaza `https://www.tudominio.com` por el dominio real en `index.html`, `robots.txt` y `sitemap.xml`.
5. Da de alta la web en Google Search Console y envía `sitemap.xml`.

## 4. Usar el panel (`/admin/`)

**Galería**
- *Añadir fotos y vídeos*: elige o arrastra varios archivos, pon título, categoría (Platos, Local, Eventos, Experiencias o una nueva) y descripción, y pulsa **Publicar**.
- Las fotos se reducen a 2200 px en WebP y se genera una miniatura de 720 px automáticamente (desde el móvil también).
- De cada vídeo se extrae una portada. Formato recomendado: **MP4 (H.264)**, máximo **50 MB** (límite del plan gratuito de Supabase). Los `.mov` del iPhone se suben, pero solo se reproducen en Safari: mejor exportarlos a MP4.
- Orden: ⤒ (al principio), ↑ y ↓. El primero de la lista es el primero en la web.
- **Editar** permite cambiar textos o *sustituir* el archivo. **Visible en la web** oculta sin borrar. **Eliminar** borra también los archivos.

**Carta**
- Secciones agrupadas en pestañas (Entrantes, Sashimi y nigiri, Makis, Gohan y postres, Té y sake, Cervezas y refrescos, Vinos y espumosos, Destilados y licores).
- Editar nombre, número, precio (vacío = sin precio), etiqueta (D.O., «Con teína»…), descripción y foto del plato; añadir, ocultar, reordenar o eliminar.
- La sección **Menú japonés** se muestra destacada arriba; su precio se lee de la nota de la sección («Menú completo · 70 €»).
- Una sección sin productos pero con nota se muestra como aviso.
- Si cambias la carta en papel, actualiza también las imágenes de `assets/carta/` y el PDF (botones «Ver carta original» y «Descargar carta»).

**Datos del restaurante**: título y frase de portada, texto y foto de *Sobre nosotros*, teléfono, WhatsApp, email, dirección (activa el mapa y «Cómo llegar»), horario, enlace a un sistema de reservas externo, redes sociales y datos legales. Lo que se deja vacío aparece en la web como «pendiente de configurar» o no se muestra (redes sociales, WhatsApp).

**Mensajes**: solicitudes de reserva y consultas, con llamada/WhatsApp directo y estado (nuevo, visto, confirmado, descartado). La web avisa al cliente de que su reserva **no está confirmada** hasta que el restaurante le contacte.

## 5. Avisos por email (opcional)

Si rellenas *Email para avisos de formularios*, cada envío llega también por correo mediante **FormSubmit** (gratuito). La **primera vez** FormSubmit envía un email de activación a esa dirección: hay que pulsar el enlace; hasta entonces no se reciben avisos (los mensajes sí quedan guardados en el panel).

## 6. Reservas

Hay dos opciones y pueden convivir:
- **Formulario propio** (activo al conectar Supabase): el cliente envía fecha, hora y personas; el restaurante confirma por teléfono/WhatsApp desde el panel.
- **Sistema externo** (CoverManager, TheFork, etc.): pega el enlace en *Datos del restaurante* y aparece el botón «Reservar online».

## 7. Pendiente de completar

- **Verificar en la carta**: precios de los uramakis 55–57 (en la captura los precios están desalineados; se ha leído 55 = 8,00 €, 56 = 10,00 €, 57 = 8,00 €) y el precio del nº 15 Usuzukuri carabinero, que no aparece en la captura (se muestra sin precio).
- Teléfono, WhatsApp, dirección, horario, email, redes sociales.
- Texto y foto de *Sobre nosotros* (ahora hay un texto provisional marcado como tal).
- Datos legales (titular, NIF, domicilio) y revisión de los textos legales.
- Iconos de alérgenos por plato: en la carta original aparecen junto a cada plato, pero son demasiado pequeños en la captura para leerlos con seguridad, por eso no se han transcrito. La web muestra la declaración general de alérgenos.
- Más fotos y vídeos propios desde el panel (ahora hay 3 fotos iniciales).

## 8. Notas técnicas

- Tipografías: Shippori Mincho B1 (títulos) y Zen Kaku Gothic New (texto), desde Google Fonts.
- El mapa de Google solo se carga cuando el visitante pulsa «Mostrar mapa» (sin cookies de terceros antes).
- Datos estructurados `Restaurant` (schema.org) que se completan con teléfono, dirección y redes al configurarlos.
- Accesibilidad: navegación por teclado, textos alternativos, contraste alto, respeta «reducir movimiento».
- Supabase gratuito pausa los proyectos tras una semana **sin actividad**; con la web recibiendo visitas no debería ocurrir, pero si se pausa se reactiva desde el panel de Supabase.
