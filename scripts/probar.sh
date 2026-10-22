#!/usr/bin/env bash
# Pruebas del guion de demostración contra una URL (local o pública).
# Uso: ./scripts/probar.sh http://localhost:8080 USUARIO CONTRASEÑA
set -u
URL="${1:-http://localhost:8080}"; USUARIO="${2:?usuario}"; CLAVE="${3:?contraseña}"
JAR="$(mktemp)"; trap 'rm -f "$JAR"' EXIT
echo "1) Formulario de inicio de sesión:"
curl -s "$URL/" | grep -o '<h1>[^<]*</h1>'
echo "2) Inicio de sesión válido:"
curl -s -c "$JAR" -o /dev/null -w "   HTTP %{http_code}\n" --data-urlencode "usuario=$USUARIO" --data-urlencode "password=$CLAVE" "$URL/login"
curl -s -b "$JAR" "$URL/bienvenida" | grep -o '<h1>[^<]*</h1>'
echo "3) Credenciales inválidas:"
curl -s -w "\n   HTTP %{http_code}\n" --data-urlencode "usuario=$USUARIO" --data-urlencode "password=incorrecta" "$URL/login" | grep -o -E 'Usuario o contraseña incorrectos.|HTTP [0-9]+'
echo "4) Bienvenida sin sesión (debe redirigir al formulario):"
curl -s -o /dev/null -w "   HTTP %{http_code} -> Location: %header{location}\n" "$URL/bienvenida"
