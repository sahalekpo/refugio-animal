-- v4: perfil animal, donaciones, voluntariado, whatsapp refugio
USE refugio_animales;

SET @db = DATABASE();

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'animales' AND COLUMN_NAME = 'vacunado') = 0,
    "ALTER TABLE animales ADD COLUMN vacunado ENUM('Si','No') NOT NULL DEFAULT 'No'",
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'animales' AND COLUMN_NAME = 'esterilizado') = 0,
    "ALTER TABLE animales ADD COLUMN esterilizado ENUM('Si','No') NOT NULL DEFAULT 'No'",
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'animales' AND COLUMN_NAME = 'desparasitado') = 0,
    "ALTER TABLE animales ADD COLUMN desparasitado ENUM('Si','No') NOT NULL DEFAULT 'No'",
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'animales' AND COLUMN_NAME = 'compatible_ninos') = 0,
    "ALTER TABLE animales ADD COLUMN compatible_ninos ENUM('Si','No','Desconocido') NOT NULL DEFAULT 'Desconocido'",
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'animales' AND COLUMN_NAME = 'compatible_mascotas') = 0,
    "ALTER TABLE animales ADD COLUMN compatible_mascotas ENUM('Si','No','Desconocido') NOT NULL DEFAULT 'Desconocido'",
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'animales' AND COLUMN_NAME = 'nivel_energia') = 0,
    "ALTER TABLE animales ADD COLUMN nivel_energia ENUM('Baja','Media','Alta') NOT NULL DEFAULT 'Media'",
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'refugio_info' AND COLUMN_NAME = 'whatsapp') = 0,
    'ALTER TABLE refugio_info ADD COLUMN whatsapp VARCHAR(30) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS donaciones (
    id_donacion INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('Donacion','Apadrinamiento') NOT NULL DEFAULT 'Donacion',
    nombres VARCHAR(120) NOT NULL,
    correo VARCHAR(100) NULL,
    telefono VARCHAR(30) NULL,
    monto_sugerido VARCHAR(50) NULL,
    id_animal INT NULL,
    mensaje TEXT NULL,
    estado ENUM('Nueva','Contactada','Cerrada') DEFAULT 'Nueva',
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_animal) REFERENCES animales(id_animal) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS voluntariados (
    id_voluntariado INT AUTO_INCREMENT PRIMARY KEY,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    correo VARCHAR(100) NOT NULL,
    telefono VARCHAR(30) NULL,
    disponibilidad VARCHAR(150) NOT NULL,
    areas_interes VARCHAR(255) NOT NULL,
    experiencia TEXT NULL,
    mensaje TEXT NULL,
    estado ENUM('Nueva','Contactada','Activa','Cerrada') DEFAULT 'Nueva',
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP VIEW IF EXISTS vw_animales_disponibles;
CREATE VIEW vw_animales_disponibles AS
SELECT a.id_animal, a.nombre, e.nombre_especie, a.raza, a.sexo, a.edad,
       a.fecha_ingreso, a.descripcion, a.foto, es.nombre_estado,
       a.vacunado, a.esterilizado, a.desparasitado,
       a.compatible_ninos, a.compatible_mascotas, a.nivel_energia,
       (SELECT ruta FROM animal_fotos f WHERE f.id_animal = a.id_animal ORDER BY f.orden, f.id_foto LIMIT 1) AS foto_principal
FROM animales a
INNER JOIN especies e ON a.id_especie = e.id_especie
INNER JOIN estados es ON a.id_estado = es.id_estado
WHERE es.nombre_estado = 'Disponible'
  AND e.nombre_especie IN ('Perro', 'Gato');
