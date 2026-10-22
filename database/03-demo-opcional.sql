-- OPCIONAL. Personas FICTICIAS, sin documentos, teléfonos ni correos.
-- No se ejecuta automáticamente. No crea usuarios ni matrículas.
SET NAMES utf8mb4;
START TRANSACTION;
INSERT INTO estudiantes (codigo_estudiante,tipo_documento,nombres,apellidos,fecha_nacimiento,sexo,estado)
SELECT 'DEMO-LIB-001','OTRO','Estudiante de prueba','Demostración Uno','2016-04-12','F','ACTIVO'
WHERE NOT EXISTS (SELECT 1 FROM estudiantes WHERE codigo_estudiante='DEMO-LIB-001');
INSERT INTO apoderados (tipo_documento,nombres,apellidos,estado)
SELECT 'OTRO','Tutor de prueba','Demostración Uno','ACTIVO'
WHERE NOT EXISTS (SELECT 1 FROM apoderados WHERE nombres='Tutor de prueba' AND apellidos='Demostración Uno');
INSERT INTO estudiante_apoderado (id_estudiante,id_apoderado,parentesco,es_principal)
SELECT e.id_estudiante,p.id_apoderado,'TUTOR',1 FROM estudiantes e JOIN apoderados p ON p.nombres='Tutor de prueba' AND p.apellidos='Demostración Uno'
WHERE e.codigo_estudiante='DEMO-LIB-001' AND NOT EXISTS (SELECT 1 FROM estudiante_apoderado r WHERE r.id_estudiante=e.id_estudiante AND r.id_apoderado=p.id_apoderado);
COMMIT;
