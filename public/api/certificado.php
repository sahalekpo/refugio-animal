<?php
require_once __DIR__ . '/config.php';

$codigo = $_GET['codigo'] ?? null;
if (!$codigo) jsonResponse(['error' => 'Código requerido'], 400);

try {
    $pdo = getConnection();
    $stmt = $pdo->prepare("
        SELECT ad.*, an.nombre AS animal, e.nombre_especie, an.raza,
               CONCAT(ap.nombres,' ',ap.apellidos) AS adoptante,
               ap.cedula, ap.direccion,
               CONCAT(em.nombres,' ',em.apellidos) AS empleado
        FROM adopciones ad
        INNER JOIN animales an ON ad.id_animal = an.id_animal
        INNER JOIN especies e ON an.id_especie = e.id_especie
        INNER JOIN adoptantes ap ON ad.id_adoptante = ap.id_adoptante
        INNER JOIN empleados em ON ad.id_empleado = em.id_empleado
        WHERE ad.certificado_codigo = ?
    ");
    $stmt->execute([$codigo]);
    $row = $stmt->fetch();
    if (!$row) jsonResponse(['error' => 'Certificado no encontrado'], 404);

    jsonResponse($row);
} catch (PDOException $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
