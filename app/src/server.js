// Aplicación web: formulario de inicio de sesión, validación contra PostgreSQL
// y página de bienvenida protegida. Toda la configuración llega por variables de entorno.
const express = require('express');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
// Si no se define SESSION_SECRET (o es corta), se genera una aleatoria en memoria:
// es segura, pero las sesiones se cierran cada vez que el contenedor se reinicia.
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  SESSION_SECRET = crypto.randomBytes(48).toString('base64url');
  console.warn('SESSION_SECRET no definida: se generó una aleatoria para este arranque.');
}

// Conexión: DATABASE_URL (Blitz Cloud la define sola) o variables PG* (Docker Compose).
const pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {});

// ---------- Sesión: cookie firmada con HMAC, sin guardar datos sensibles ----------
const COOKIE = 'sesion';
const DURACION_MS = 60 * 60 * 1000; // 1 hora
const firmar = (v) => crypto.createHmac('sha256', SESSION_SECRET).update(v).digest('base64url');
function crearCookie(userId) {
  const valor = `${userId}.${Date.now() + DURACION_MS}`;
  return `${valor}.${firmar(valor)}`;
}
function leerSesion(req) {
  const raw = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return null;
  const [id, exp, firma] = decodeURIComponent(raw.slice(COOKIE.length + 1)).split('.');
  if (!id || !exp || !firma) return null;
  const esperada = firmar(`${id}.${exp}`);
  if (firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
  if (Number(exp) < Date.now()) return null;
  return Number(id);
}
const seguro = process.env.COOKIE_SECURE === 'true';
const opcionesCookie = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${DURACION_MS / 1000}${seguro ? '; Secure' : ''}`;

// ---------- Vistas ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pagina = (titulo, cuerpo) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title><link rel="stylesheet" href="/estilos.css"></head><body><main class="tarjeta">${cuerpo}</main>
<footer>Cloud Computing · USIL · Actividad Semana 10</footer></body></html>`;
const login = (error = '') => pagina('Iniciar sesión', `<h1>Iniciar sesión</h1><p class="sub">Aplicación en contenedores: Nginx, Node.js y PostgreSQL</p>
${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
<form method="post" action="/login"><label>Usuario<input name="usuario" autocomplete="username" required maxlength="50"></label>
<label>Contraseña<input name="password" type="password" autocomplete="current-password" required maxlength="100"></label>
<button>Entrar</button></form>`);

// ---------- Rutas ----------
const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '2kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => (leerSesion(req) ? res.redirect('/bienvenida') : res.send(login())));

app.post('/login', async (req, res) => {
  const usuario = String(req.body.usuario || '').trim().slice(0, 50);
  const password = String(req.body.password || '').slice(0, 100);
  try {
    // Consulta parametrizada ($1): evita inyección SQL.
    const { rows } = await pool.query('SELECT id, password_hash FROM usuarios WHERE usuario = $1', [usuario]);
    const ok = rows.length === 1 && (await bcrypt.compare(password, rows[0].password_hash));
    if (!ok) return res.status(401).send(login('Usuario o contraseña incorrectos.'));
    res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(crearCookie(rows[0].id))}; ${opcionesCookie}`);
    return res.redirect(303, '/bienvenida');
  } catch (e) {
    console.error('Error de base de datos:', e.message);
    return res.status(503).send(login('El servicio no está disponible. Intenta en unos segundos.'));
  }
});

app.get('/bienvenida', async (req, res) => {
  const id = leerSesion(req);
  if (!id) return res.redirect('/'); // página protegida: sin sesión no se muestra
  const { rows } = await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [id]);
  if (!rows.length) return res.redirect('/');
  res.send(pagina('Bienvenida', `<h1>Bienvenido, ${esc(rows[0].nombre)}</h1>
<p>Iniciaste sesión correctamente. Esta página solo es visible con una sesión válida.</p>
<form method="post" action="/logout"><button class="secundario">Cerrar sesión</button></form>`));
});

app.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.redirect(303, '/');
});

app.get('/salud', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
});

// ---------- Arranque: espera a la base de datos y ejecuta el script de inicialización ----------
async function iniciar() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'init.sql'), 'utf8');
  for (let intento = 1; intento <= 30; intento++) {
    try { await pool.query(sql); break; } catch (e) {
      if (intento === 30) { console.error('No se pudo conectar a la base de datos:', e.message); process.exit(1); }
      console.log(`Esperando a la base de datos (intento ${intento})...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Aplicación escuchando en el puerto ${PORT}`));
}
iniciar();
