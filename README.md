# Login en contenedores: Nginx + Node.js + PostgreSQL

Actividad calificada de la Semana 10 del curso Cloud Computing (USIL, 2026-2).
Es una aplicación web con inicio de sesión que valida al usuario contra PostgreSQL y
solo muestra la página de bienvenida si el usuario se autenticó.


## Arquitectura

```
Navegador ──HTTPS──> [ proxy: Nginx :80 ] ──red frontend──> [ app: Node.js :3000 ] ──red backend (interna)──> [ db: PostgreSQL 17 ]
                       único puerto público                     imagen propia                                   volumen datos_pg
```

| Servicio | Imagen | Rol |
|---|---|---|
| proxy | `nginx:1.27.3-alpine` | Punto de entrada único; reenvía a la app. |
| app | `s82833/usil-cloud-login:1.0.1` (propia) | Formulario, validación con bcrypt, sesión y bienvenida. |
| db | `postgres:17.2-alpine` | Tabla `usuarios` con hash; sin puertos publicados. |

Nube (Opción A, Blitz Cloud): la app se despliega desde Docker Hub y usa la base PostgreSQL
administrada de Blitz mediante `DATABASE_URL`. Blitz entrega el HTTPS, por eso Nginx solo se usa en local.

## Ejecutar en local

```bash
cp .env.example .env          # y cambia las claves
docker compose up -d --build
# Abrir http://localhost:8080
```

Usuarios de prueba (ficticios): `ana.prueba` / `Prueba-Ana-2026` y `luis.prueba` / `Prueba-Luis-2026`.

## Probar el guion de la demostración

```bash
bash scripts/probar.sh http://localhost:8080 ana.prueba Prueba-Ana-2026   # pasos 1 a 4
bash scripts/probar-local.sh                                              # hash, persistencia y red
```

## Publicar la imagen

```bash
docker login -u TU_USUARIO              # con un access token de Docker Hub
docker build --platform linux/amd64 -f app/Dockerfile -t TU_USUARIO/usil-cloud-login:1.0.1 .
docker push TU_USUARIO/usil-cloud-login:1.0.1
```

## Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión completa (la define Blitz Cloud). Si no existe, se usan `PGHOST`, `PGUSER`, etc. |
| `SESSION_SECRET` | Firma de la cookie de sesión (32+ caracteres aleatorios). |
| `PORT` | Puerto de la app (3000). |
| `COOKIE_SECURE` | `true` en la nube (HTTPS). |

## Seguridad

- Contraseñas con bcrypt (costo 12); nunca en texto plano.
- Consultas parametrizadas (`$1`) contra inyección SQL.
- Credenciales solo en `.env` (excluido por `.gitignore` y `.dockerignore`).
- La base de datos no publica puertos y está en una red interna sin salida a internet.
- Cookie de sesión firmada con HMAC, `HttpOnly`, `SameSite=Lax` y `Secure` en la nube; caduca en 1 hora.
- El contenedor de la app corre sin privilegios de root.

## Limpieza

```bash
docker compose down        # conserva el volumen
docker compose down -v     # borra también los datos
```
En Blitz Cloud: borrar la app y la base de datos después de la exposición.
