-- Script de inicialización de la base de datos.
-- Lo ejecuta PostgreSQL la primera vez que crea el volumen (entorno local)
-- y la aplicación al arrancar (Blitz Cloud). Es idempotente: se puede correr varias veces.

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  usuario       VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,          -- hash bcrypt, nunca la contraseña en texto plano
  nombre        VARCHAR(100) NOT NULL,
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Usuarios de prueba con datos ficticios (hash bcrypt, costo 12).
INSERT INTO usuarios (usuario, password_hash, nombre) VALUES
  ('ana.prueba',  '$2a$12$gOQMR8/jOk2RL9T.rhiwkelUL1FVFsQcDrHdTHCqd.UKE5HFTMXk2', 'Ana Prueba'),
  ('luis.prueba', '$2a$12$j/IWjVrUXbm5OV42iOrXCejinnX.20711ej4e2h1461FtfwsWNIZO', 'Luis Prueba')
ON CONFLICT (usuario) DO NOTHING;
