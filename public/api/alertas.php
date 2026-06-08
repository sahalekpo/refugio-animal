<?php
require_once __DIR__ . '/config.php';

try {
    requireAuth();
    $pdo = getConnection();

    $postulaciones = (int) $pdo->query("SELECT COUNT(*) FROM postulaciones WHERE estado_postulacion = 'Pendiente'")->fetchColumn();

    $vacunas = $pdo->query("
        SELECT v.*, a.nombre AS animal
        FROM vacunas v
        INNER JOIN animales a ON v.id_animal = a.id_animal
        WHERE v.fecha_proxima <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)
          AND v.estado != 'Aplicada'
        ORDER BY v.fecha_proxima ASC
        LIMIT 20
    ")->fetchAll();

    $visitas = $pdo->query("
        SELECT v.id_visita, v.fecha_programada, an.nombre AS animal,
               CONCAT(ap.nombres,' ',ap.apellidos) AS adoptante
        FROM visitas_seguimiento v
        INNER JOIN adopciones ad ON v.id_adopcion = ad.id_adopcion
        INNER JOIN animales an ON ad.id_animal = an.id_animal
        INNER JOIN adoptantes ap ON ad.id_adoptante = ap.id_adoptante
        WHERE v.estado = 'Programada' AND v.fecha_programada <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        ORDER BY v.fecha_programada ASC
        LIMIT 15
    ")->fetchAll();

    jsonResponse([
        'postulaciones_pendientes' => $postulaciones,
        'vacunas_proximas' => $vacunas,
        'visitas_proximas' => $visitas,
        'total_alertas' => $postulaciones + count($vacunas) + count($visitas)
    ]);
} catch (PDOException $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
