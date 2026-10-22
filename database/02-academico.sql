-- Configuración académica FICTICIA de demostración. Es idempotente.
-- No modifica capacidades ni estados de registros que ya existan.
SET NAMES utf8mb4;
START TRANSACTION;
INSERT INTO anios_escolares (anio,estado)
SELECT 2026,'ACTIVO' WHERE NOT EXISTS (SELECT 1 FROM anios_escolares WHERE anio=2026);
INSERT INTO grados (nivel,numero_grado)
SELECT n.nivel,g.numero FROM (SELECT 'PRIMARIA' AS nivel UNION ALL SELECT 'SECUNDARIA') n
CROSS JOIN (SELECT 1 AS numero UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) g
WHERE (n.nivel='PRIMARIA' OR g.numero<=5)
AND NOT EXISTS (SELECT 1 FROM grados x WHERE x.nivel=n.nivel AND x.numero_grado=g.numero);
INSERT INTO secciones (id_anio,id_grado,nombre,capacidad,estado)
SELECT a.id_anio,g.id_grado,l.nombre,30,'ACTIVA' FROM anios_escolares a CROSS JOIN grados g
CROSS JOIN (SELECT 'A' AS nombre UNION ALL SELECT 'B' UNION ALL SELECT 'C'
 UNION ALL SELECT 'D' UNION ALL SELECT 'E' UNION ALL SELECT 'F'
 UNION ALL SELECT 'G' UNION ALL SELECT 'H' UNION ALL SELECT 'I') l
WHERE a.anio=2026 AND NOT EXISTS (SELECT 1 FROM secciones s WHERE s.id_anio=a.id_anio AND s.id_grado=g.id_grado AND s.nombre=l.nombre)
ORDER BY g.id_grado,l.nombre;
COMMIT;
