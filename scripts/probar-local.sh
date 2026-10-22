#!/usr/bin/env bash
# Pruebas del entorno local: hash en la BD, persistencia, BD no expuesta y red interna.
# Uso: bash scripts/probar-local.sh   (desde la carpeta del proyecto)
set -u
sql() { docker compose exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" $1"; }

echo "5) Contraseñas almacenadas con hash:"
sql "-c 'SELECT id, usuario, left(password_hash, 29) AS inicio_del_hash, nombre FROM usuarios;'"

echo "6) Persistencia: se elimina y se recrea el contenedor de la base de datos"
docker compose rm --stop --force db
docker compose up --detach --wait db
echo -n "   Usuarios después de recrear: "; sql "-tAc 'SELECT count(*) FROM usuarios;'"
docker volume ls --filter name=datos_pg

echo "7) La base de datos no publica puertos ni tiene salida a internet:"
docker compose ps --format '   {{.Service}}: {{.Ports}}'
docker network inspect usil-cloud-login_backend --format '   Red backend interna: {{.Internal}}'
