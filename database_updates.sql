-- Actualización BD Refugio de Animales v2
-- Ejecutar en MySQL Workbench o: php public/api/migrate.php

USE refugio_animales;

INSERT IGNORE INTO estados (nombre_estado) VALUES ('En proceso de adopción');

CREATE TABLE IF NOT EXISTS postulaciones (
    id_postulacion INT AUTO_INCREMENT PRIMARY KEY,
    id_animal INT NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    cedula VARCHAR(20) NOT NULL,
    telefono VARCHAR(20),
    correo VARCHAR(100),
    direccion VARCHAR(200),
    tipo_vivienda ENUM('Casa','Apartamento','Finca','Otro') NOT NULL,
    tiene_patio ENUM('Si','No') NOT NULL,
    adultos_hogar INT DEFAULT 0,
    ninos_hogar INT DEFAULT 0,
    experiencia_mascotas ENUM('Si','No','Poca') NOT NULL,
    otras_mascotas ENUM('Si','No') NOT NULL,
    detalle_otras_mascotas VARCHAR(255),
    motivo_adopcion TEXT NOT NULL,
    tiempo_disponible VARCHAR(100),
    acepta_visitas ENUM('Si','No') NOT NULL,
    estado_postulacion ENUM('Pendiente','Aprobada','Rechazada') DEFAULT 'Pendiente',
    fecha_postulacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_animal) REFERENCES animales(id_animal)
);

CREATE TABLE IF NOT EXISTS visitas_seguimiento (
    id_visita INT AUTO_INCREMENT PRIMARY KEY,
    id_adopcion INT NOT NULL,
    fecha_programada DATE NOT NULL,
    fecha_realizada DATE NULL,
    observaciones TEXT,
    estado ENUM('Programada','Realizada','Cancelada') DEFAULT 'Programada',
    FOREIGN KEY (id_adopcion) REFERENCES adopciones(id_adopcion) ON DELETE CASCADE
);

-- Columnas nuevas en adopciones (ignorar error si ya existen)
SET @db = DATABASE();

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'adopciones' AND COLUMN_NAME = 'frecuencia_visitas') = 0,
    'ALTER TABLE adopciones ADD COLUMN frecuencia_visitas VARCHAR(50) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'adopciones' AND COLUMN_NAME = 'certificado_codigo') = 0,
    'ALTER TABLE adopciones ADD COLUMN certificado_codigo VARCHAR(50) NULL UNIQUE',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'adopciones' AND COLUMN_NAME = 'proxima_visita') = 0,
    'ALTER TABLE adopciones ADD COLUMN proxima_visita DATE NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

DROP VIEW IF EXISTS vw_animales_disponibles;
CREATE VIEW vw_animales_disponibles AS
SELECT a.id_animal, a.nombre, e.nombre_especie, a.raza, a.sexo, a.edad,
       a.fecha_ingreso, a.descripcion, a.foto, es.nombre_estado
FROM animales a
INNER JOIN especies e ON a.id_especie = e.id_especie
INNER JOIN estados es ON a.id_estado = es.id_estado
WHERE es.nombre_estado = 'Disponible'
  AND e.nombre_especie IN ('Perro', 'Gato');

DROP VIEW IF EXISTS vw_animales_adoptados;
CREATE VIEW vw_animales_adoptados AS
SELECT a.id_animal, a.nombre, e.nombre_especie, a.raza, a.foto,
       ad.id_adopcion, ad.fecha_adopcion, ad.frecuencia_visitas, ad.proxima_visita,
       ad.certificado_codigo,
       CONCAT(ap.nombres,' ',ap.apellidos) AS adoptante
FROM animales a
INNER JOIN especies e ON a.id_especie = e.id_especie
INNER JOIN estados es ON a.id_estado = es.id_estado
INNER JOIN adopciones ad ON ad.id_animal = a.id_animal
INNER JOIN adoptantes ap ON ad.id_adoptante = ap.id_adoptante
WHERE es.nombre_estado = 'Adoptado'
  AND e.nombre_especie IN ('Perro', 'Gato');

DROP TRIGGER IF EXISTS tr_estado_proceso_adopcion;
DELIMITER $$
CREATE TRIGGER tr_estado_proceso_adopcion
AFTER INSERT ON postulaciones
FOR EACH ROW
BEGIN
    UPDATE animales
    SET id_estado = (SELECT id_estado FROM estados WHERE nombre_estado = 'En proceso de adopción' LIMIT 1)
    WHERE id_animal = NEW.id_animal
      AND id_estado = (SELECT id_estado FROM estados WHERE nombre_estado = 'Disponible' LIMIT 1);
END$$
DELIMITER ;

-- Usuario admin por defecto: admin / Admin2025!
INSERT IGNORE INTO usuarios (usuario, contrasena, rol)
SELECT 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrador'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE usuario = 'admin');
