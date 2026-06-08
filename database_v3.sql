USE refugio_animales;

CREATE TABLE IF NOT EXISTS animal_fotos (
    id_foto INT AUTO_INCREMENT PRIMARY KEY,
    id_animal INT NOT NULL,
    ruta VARCHAR(255) NOT NULL,
    orden INT DEFAULT 0,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_animal) REFERENCES animales(id_animal) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vacunas (
    id_vacuna INT AUTO_INCREMENT PRIMARY KEY,
    id_animal INT NOT NULL,
    nombre_vacuna VARCHAR(100) NOT NULL,
    fecha_aplicada DATE,
    fecha_proxima DATE NOT NULL,
    observaciones TEXT,
    estado ENUM('Pendiente','Aplicada','Vencida') DEFAULT 'Pendiente',
    FOREIGN KEY (id_animal) REFERENCES animales(id_animal) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refugio_info (
    id INT PRIMARY KEY DEFAULT 1,
    nombre VARCHAR(150) NOT NULL DEFAULT 'Refugio de Animales',
    descripcion TEXT,
    mision TEXT,
    correo VARCHAR(100),
    telefono VARCHAR(30),
    direccion VARCHAR(255),
    horario VARCHAR(150),
    facebook VARCHAR(200),
    instagram VARCHAR(200)
);

INSERT INTO refugio_info (id, nombre, descripcion, mision, correo, telefono, direccion, horario)
VALUES (
    1,
    'Refugio de Animales Esperanza',
    'Somos una organización dedicada al rescate, rehabilitación y adopción responsable de perros y gatos. Trabajamos para encontrar hogares llenos de amor.',
    'Promover el bienestar animal mediante adopciones responsables, esterilización y educación comunitaria.',
    'contacto@refugioesperanza.org',
    '+57 300 123 4567',
    'Calle 45 #12-30, Barrio El Refugio, Ciudad',
    'Lun–Vie 8:00–17:00 | Sáb 9:00–13:00'
) ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

DROP VIEW IF EXISTS vw_animales_disponibles;
CREATE VIEW vw_animales_disponibles AS
SELECT a.id_animal, a.nombre, e.nombre_especie, a.raza, a.sexo, a.edad,
       a.fecha_ingreso, a.descripcion, a.foto, es.nombre_estado,
       (SELECT ruta FROM animal_fotos f WHERE f.id_animal = a.id_animal ORDER BY f.orden, f.id_foto LIMIT 1) AS foto_principal
FROM animales a
INNER JOIN especies e ON a.id_especie = e.id_especie
INNER JOIN estados es ON a.id_estado = es.id_estado
WHERE es.nombre_estado = 'Disponible'
  AND e.nombre_especie IN ('Perro', 'Gato');
