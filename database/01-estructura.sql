-- Esquema real de MariaDB. Solo estructura; sin cuentas, contraseñas ni datos personales.
-- Selecciona una base vacía en phpMyAdmin antes de importar. No actualiza tablas existentes.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id_usuario` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `usuario` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `nombre_completo` varchar(150) NOT NULL,
  `rol` enum('ADMINISTRADOR','MATRICULAS') NOT NULL DEFAULT 'MATRICULAS',
  `estado` enum('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `usuario` (`usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudiantes` (
  `id_estudiante` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `codigo_estudiante` varchar(20) NOT NULL,
  `tipo_documento` enum('DNI','CE','OTRO') NOT NULL DEFAULT 'DNI',
  `numero_documento` varchar(20) DEFAULT NULL,
  `nombres` varchar(100) NOT NULL,
  `apellidos` varchar(120) NOT NULL,
  `fecha_nacimiento` date DEFAULT NULL,
  `sexo` enum('M','F') DEFAULT NULL,
  `estado` enum('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_estudiante`),
  UNIQUE KEY `codigo_estudiante` (`codigo_estudiante`),
  UNIQUE KEY `numero_documento` (`numero_documento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `apoderados` (
  `id_apoderado` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `tipo_documento` enum('DNI','CE','OTRO') NOT NULL DEFAULT 'DNI',
  `numero_documento` varchar(20) DEFAULT NULL,
  `nombres` varchar(100) NOT NULL,
  `apellidos` varchar(120) NOT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `correo` varchar(120) DEFAULT NULL,
  `estado` enum('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  PRIMARY KEY (`id_apoderado`),
  UNIQUE KEY `numero_documento` (`numero_documento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `anios_escolares` (
  `id_anio` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `anio` smallint(5) unsigned NOT NULL,
  `estado` enum('ACTIVO','CERRADO') NOT NULL DEFAULT 'ACTIVO',
  PRIMARY KEY (`id_anio`),
  UNIQUE KEY `anio` (`anio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grados` (
  `id_grado` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nivel` enum('PRIMARIA','SECUNDARIA') NOT NULL,
  `numero_grado` tinyint(3) unsigned NOT NULL,
  PRIMARY KEY (`id_grado`),
  UNIQUE KEY `uq_nivel_grado` (`nivel`,`numero_grado`),
  CONSTRAINT `chk_numero_grado` CHECK (`nivel` = 'PRIMARIA' and `numero_grado` between 1 and 6 or `nivel` = 'SECUNDARIA' and `numero_grado` between 1 and 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudiante_apoderado` (
  `id_relacion` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_estudiante` int(10) unsigned NOT NULL,
  `id_apoderado` int(10) unsigned NOT NULL,
  `parentesco` enum('PADRE','MADRE','TUTOR','OTRO') NOT NULL,
  `es_principal` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id_relacion`),
  UNIQUE KEY `uq_estudiante_apoderado` (`id_estudiante`,`id_apoderado`),
  KEY `fk_rel_apoderado` (`id_apoderado`),
  CONSTRAINT `fk_rel_apoderado` FOREIGN KEY (`id_apoderado`) REFERENCES `apoderados` (`id_apoderado`),
  CONSTRAINT `fk_rel_estudiante` FOREIGN KEY (`id_estudiante`) REFERENCES `estudiantes` (`id_estudiante`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `secciones` (
  `id_seccion` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_anio` int(10) unsigned NOT NULL,
  `id_grado` int(10) unsigned NOT NULL,
  `nombre` varchar(5) NOT NULL,
  `capacidad` int(10) unsigned NOT NULL DEFAULT 30,
  `estado` enum('ACTIVA','INACTIVA') NOT NULL DEFAULT 'ACTIVA',
  PRIMARY KEY (`id_seccion`),
  UNIQUE KEY `uq_seccion` (`id_anio`,`id_grado`,`nombre`),
  UNIQUE KEY `uq_seccion_anio` (`id_seccion`,`id_anio`),
  KEY `fk_seccion_grado` (`id_grado`),
  CONSTRAINT `fk_seccion_anio` FOREIGN KEY (`id_anio`) REFERENCES `anios_escolares` (`id_anio`),
  CONSTRAINT `fk_seccion_grado` FOREIGN KEY (`id_grado`) REFERENCES `grados` (`id_grado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `matriculas` (
  `id_matricula` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_estudiante` int(10) unsigned NOT NULL,
  `id_anio` int(10) unsigned NOT NULL,
  `id_seccion` int(10) unsigned NOT NULL,
  `fecha_matricula` date NOT NULL,
  `estado` enum('REGISTRADA','ANULADA') NOT NULL DEFAULT 'REGISTRADA',
  `observaciones` text DEFAULT NULL,
  PRIMARY KEY (`id_matricula`),
  UNIQUE KEY `uq_estudiante_anio` (`id_estudiante`,`id_anio`),
  KEY `fk_matricula_seccion_anio` (`id_seccion`,`id_anio`),
  CONSTRAINT `fk_matricula_estudiante` FOREIGN KEY (`id_estudiante`) REFERENCES `estudiantes` (`id_estudiante`),
  CONSTRAINT `fk_matricula_seccion_anio` FOREIGN KEY (`id_seccion`, `id_anio`) REFERENCES `secciones` (`id_seccion`, `id_anio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

