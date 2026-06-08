CREATE DATABASE refugio_animales;
USE refugio_animales;

CREATE TABLE estados (
    id_estado INT AUTO_INCREMENT PRIMARY KEY,
    nombre_estado VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO estados(nombre_estado)
VALUES
('Disponible'),
('Adoptado'),
('En tratamiento'),
('Reservado');

CREATE TABLE especies (
    id_especie INT AUTO_INCREMENT PRIMARY KEY,
    nombre_especie VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO especies(nombre_especie)
VALUES
('Perro'),
('Gato');

CREATE TABLE animales (
    id_animal INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    id_especie INT NOT NULL,
    raza VARCHAR(100),
    sexo ENUM('Macho','Hembra') NOT NULL,
    edad INT,
    fecha_ingreso DATE NOT NULL,
    descripcion TEXT,
    foto VARCHAR(255),
    vacunado ENUM('Si','No') NOT NULL DEFAULT 'No',
    esterilizado ENUM('Si','No') NOT NULL DEFAULT 'No',
    desparasitado ENUM('Si','No') NOT NULL DEFAULT 'No',
    compatible_ninos ENUM('Si','No','Desconocido') NOT NULL DEFAULT 'Desconocido',
    compatible_mascotas ENUM('Si','No','Desconocido') NOT NULL DEFAULT 'Desconocido',
    nivel_energia ENUM('Baja','Media','Alta') NOT NULL DEFAULT 'Media',
    id_estado INT NOT NULL,

    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY(id_especie)
    REFERENCES especies(id_especie),

    FOREIGN KEY(id_estado)
    REFERENCES estados(id_estado)
);

CREATE TABLE adoptantes (
    id_adoptante INT AUTO_INCREMENT PRIMARY KEY,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    correo VARCHAR(100),
    direccion VARCHAR(200),

    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE empleados (
    id_empleado INT AUTO_INCREMENT PRIMARY KEY,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    cargo VARCHAR(100),
    telefono VARCHAR(20),
    correo VARCHAR(100),

    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    rol ENUM('Administrador','Empleado') NOT NULL,
    id_empleado INT,

    FOREIGN KEY(id_empleado)
    REFERENCES empleados(id_empleado)
);

CREATE TABLE historial_medico (
    id_historial INT AUTO_INCREMENT PRIMARY KEY,
    id_animal INT NOT NULL,
    fecha DATE NOT NULL,
    descripcion TEXT NOT NULL,

    FOREIGN KEY(id_animal)
    REFERENCES animales(id_animal)
);

CREATE TABLE adopciones (
    id_adopcion INT AUTO_INCREMENT PRIMARY KEY,

    id_animal INT NOT NULL,
    id_adoptante INT NOT NULL,
    id_empleado INT NOT NULL,

    fecha_adopcion DATE NOT NULL,

    FOREIGN KEY(id_animal)
    REFERENCES animales(id_animal),

    FOREIGN KEY(id_adoptante)
    REFERENCES adoptantes(id_adoptante),

    FOREIGN KEY(id_empleado)
    REFERENCES empleados(id_empleado),

    CONSTRAINT uq_animal UNIQUE(id_animal)
);

DELIMITER $$

CREATE TRIGGER tr_actualizar_estado_animal
AFTER INSERT ON adopciones
FOR EACH ROW
BEGIN

    UPDATE animales
    SET id_estado =
    (
        SELECT id_estado
        FROM estados
        WHERE nombre_estado = 'Adoptado'
    )
    WHERE id_animal = NEW.id_animal;

END$$

DELIMITER ;

DELIMITER $$

CREATE FUNCTION fn_total_adopciones()
RETURNS INT
DETERMINISTIC
BEGIN

    DECLARE total INT;

    SELECT COUNT(*)
    INTO total
    FROM adopciones;

    RETURN total;

END$$

DELIMITER ;

SELECT fn_total_adopciones();

CREATE VIEW vw_animales_disponibles AS
SELECT
a.id_animal,
a.nombre,
e.nombre_especie,
a.raza,
a.edad,
es.nombre_estado
FROM animales a
INNER JOIN especies e
ON a.id_especie = e.id_especie
INNER JOIN estados es
ON a.id_estado = es.id_estado
WHERE es.nombre_estado = 'Disponible';


CREATE VIEW vw_historial_adopciones AS
SELECT
ad.id_adopcion,
an.nombre AS animal,
CONCAT(ap.nombres,' ',ap.apellidos)
AS adoptante,
CONCAT(em.nombres,' ',em.apellidos)
AS empleado,
ad.fecha_adopcion
FROM adopciones ad
INNER JOIN animales an
ON ad.id_animal = an.id_animal
INNER JOIN adoptantes ap
ON ad.id_adoptante = ap.id_adoptante
INNER JOIN empleados em
ON ad.id_empleado = em.id_empleado;

DELIMITER $$

CREATE PROCEDURE sp_registrar_animal(
IN p_nombre VARCHAR(100),
IN p_id_especie INT,
IN p_raza VARCHAR(100),
IN p_sexo VARCHAR(20),
IN p_edad INT,
IN p_fecha_ingreso DATE,
IN p_descripcion TEXT
)
BEGIN

INSERT INTO animales
(
nombre,
id_especie,
raza,
sexo,
edad,
fecha_ingreso,
descripcion,
id_estado
)

VALUES
(
p_nombre,
p_id_especie,
p_raza,
p_sexo,
p_edad,
p_fecha_ingreso,
p_descripcion,
1
);
END$$

DELIMITER ;

-- Datos de ejemplo para pruebas
INSERT INTO empleados (nombres, apellidos, cargo, telefono, correo) VALUES
('María', 'González', 'Coordinadora de Adopciones', '555-0101', 'maria@refugio.com'),
('Carlos', 'Ramírez', 'Veterinario', '555-0102', 'carlos@refugio.com');

INSERT INTO adoptantes (nombres, apellidos, cedula, telefono, correo, direccion) VALUES
('Ana', 'López', '1234567890', '555-0201', 'ana.lopez@email.com', 'Calle 10 #5-20'),
('Pedro', 'Martínez', '0987654321', '555-0202', 'pedro.m@email.com', 'Av. Central 45');

CALL sp_registrar_animal('Max', 1, 'Labrador', 'Macho', 3, '2025-01-15', 'Perro amigable y juguetón');
CALL sp_registrar_animal('Luna', 2, 'Siamés', 'Hembra', 2, '2025-02-20', 'Gata tranquila, ideal para apartamento');
CALL sp_registrar_animal('Rocky', 1, 'Mestizo', 'Macho', 5, '2024-11-10', 'Perro mediano, muy sociable');
CALL sp_registrar_animal('Mimi', 2, 'Persa', 'Hembra', 1, '2025-03-05', 'Gatita joven y cariñosa');