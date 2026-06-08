-- Solo perros y gatos: eliminar Ave, Conejo, Otro y sus animales
USE refugio_animales;

DELETE vs FROM visitas_seguimiento vs
INNER JOIN adopciones ad ON vs.id_adopcion = ad.id_adopcion
INNER JOIN animales a ON ad.id_animal = a.id_animal
INNER JOIN especies e ON a.id_especie = e.id_especie
WHERE e.nombre_especie IN ('Ave', 'Conejo', 'Otro');

DELETE ad FROM adopciones ad
INNER JOIN animales a ON ad.id_animal = a.id_animal
INNER JOIN especies e ON a.id_especie = e.id_especie
WHERE e.nombre_especie IN ('Ave', 'Conejo', 'Otro');

DELETE p FROM postulaciones p
INNER JOIN animales a ON p.id_animal = a.id_animal
INNER JOIN especies e ON a.id_especie = e.id_especie
WHERE e.nombre_especie IN ('Ave', 'Conejo', 'Otro');

DELETE v FROM vacunas v
INNER JOIN animales a ON v.id_animal = a.id_animal
INNER JOIN especies e ON a.id_especie = e.id_especie
WHERE e.nombre_especie IN ('Ave', 'Conejo', 'Otro');

DELETE af FROM animal_fotos af
INNER JOIN animales a ON af.id_animal = a.id_animal
INNER JOIN especies e ON a.id_especie = e.id_especie
WHERE e.nombre_especie IN ('Ave', 'Conejo', 'Otro');

DELETE hm FROM historial_medico hm
INNER JOIN animales a ON hm.id_animal = a.id_animal
INNER JOIN especies e ON a.id_especie = e.id_especie
WHERE e.nombre_especie IN ('Ave', 'Conejo', 'Otro');

DELETE a FROM animales a
INNER JOIN especies e ON a.id_especie = e.id_especie
WHERE e.nombre_especie IN ('Ave', 'Conejo', 'Otro');

DELETE FROM especies WHERE nombre_especie IN ('Ave', 'Conejo', 'Otro');

UPDATE refugio_info
SET descripcion = 'Somos una organización dedicada al rescate, rehabilitación y adopción responsable de perros y gatos. Trabajamos para encontrar hogares llenos de amor.'
WHERE id = 1;

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
