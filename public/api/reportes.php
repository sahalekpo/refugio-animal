<?php
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'dashboard';

try {
    requireAuth();
    $pdo = getConnection();

    if ($action === 'dashboard') {
        $total = 0;
        try {
            $total = (int) $pdo->query('SELECT fn_total_adopciones() AS total')->fetch()['total'];
        } catch (PDOException $e) {
            $total = (int) $pdo->query('SELECT COUNT(*) FROM adopciones')->fetchColumn();
        }
        $totalAnimales = (int) $pdo->query('SELECT COUNT(*) FROM animales')->fetchColumn();
        $disponibles = (int) $pdo->query("
            SELECT COUNT(*) FROM animales a
            INNER JOIN estados e ON a.id_estado = e.id_estado
            WHERE e.nombre_estado = 'Disponible'
        ")->fetchColumn();
        $totalAdoptantes = (int) $pdo->query('SELECT COUNT(*) FROM adoptantes')->fetchColumn();
        $totalEmpleados = (int) $pdo->query('SELECT COUNT(*) FROM empleados')->fetchColumn();
        $postulaciones = (int) $pdo->query("SELECT COUNT(*) FROM postulaciones WHERE estado_postulacion='Pendiente'")->fetchColumn();
        $vacunasAlerta = (int) $pdo->query("
            SELECT COUNT(*) FROM vacunas WHERE fecha_proxima <= DATE_ADD(CURDATE(), INTERVAL 14 DAY) AND estado != 'Aplicada'
        ")->fetchColumn();

        jsonResponse([
            'total_adopciones' => $total,
            'total_animales' => $totalAnimales,
            'animales_disponibles' => $disponibles,
            'total_adoptantes' => $totalAdoptantes,
            'total_empleados' => $totalEmpleados,
            'postulaciones_pendientes' => $postulaciones,
            'vacunas_alertas' => $vacunasAlerta
        ]);
    }

    if ($action === 'animales-disponibles') {
        $stmt = $pdo->query('SELECT * FROM vw_animales_disponibles');
        jsonResponse($stmt->fetchAll());
    }

    if ($action === 'historial-adopciones') {
        $stmt = $pdo->query('SELECT * FROM vw_historial_adopciones ORDER BY fecha_adopcion DESC');
        jsonResponse($stmt->fetchAll());
    }

    jsonResponse(['error' => 'Acción no válida'], 400);
} catch (PDOException $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
