-- Migración incremental de DATOS: distribución FICTICIA A-I para 2026.
-- Antes de ejecutarla, guardar una copia privada de la base.
-- Requiere el año 2026 y exactamente seis grados de primaria y cinco de secundaria.
-- Sin esos requisitos la inserción no realiza cambios: revisar las consultas finales.
-- Conserva IDs, capacidades, estados y matrículas de TODAS las secciones existentes.
-- No modifica otros años ni requiere permisos DDL.
SET NAMES utf8mb4;
START TRANSACTION;
SELECT id_anio FROM anios_escolares WHERE anio=2026 FOR UPDATE;
INSERT INTO secciones (id_anio,id_grado,nombre,capacidad,estado)
SELECT a.id_anio,g.id_grado,l.nombre,30,'ACTIVA'
FROM anios_escolares a CROSS JOIN grados g
CROSS JOIN (SELECT 'A' AS nombre UNION ALL SELECT 'B' UNION ALL SELECT 'C'
 UNION ALL SELECT 'D' UNION ALL SELECT 'E' UNION ALL SELECT 'F'
 UNION ALL SELECT 'G' UNION ALL SELECT 'H' UNION ALL SELECT 'I') l
WHERE a.anio=2026
AND (SELECT COUNT(*) FROM grados)=11
AND (SELECT COUNT(*) FROM grados WHERE nivel='PRIMARIA' AND numero_grado BETWEEN 1 AND 6)=6
AND (SELECT COUNT(*) FROM grados WHERE nivel='SECUNDARIA' AND numero_grado BETWEEN 1 AND 5)=5
AND NOT EXISTS (SELECT 1 FROM secciones s WHERE s.id_anio=a.id_anio AND s.id_grado=g.id_grado AND s.nombre=l.nombre)
ORDER BY g.id_grado,l.nombre;
COMMIT;
SELECT g.nivel,COUNT(*) AS secciones FROM secciones s JOIN grados g USING(id_grado)
JOIN anios_escolares a USING(id_anio) WHERE a.anio=2026 GROUP BY g.nivel;
SELECT g.nivel,g.numero_grado,COUNT(*) AS secciones,GROUP_CONCAT(s.nombre ORDER BY s.nombre SEPARATOR ',') AS letras
FROM secciones s JOIN grados g USING(id_grado) JOIN anios_escolares a USING(id_anio)
WHERE a.anio=2026 GROUP BY g.id_grado,g.nivel,g.numero_grado ORDER BY g.nivel,g.numero_grado;
