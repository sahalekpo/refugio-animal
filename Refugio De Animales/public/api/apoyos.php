<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    $pdo = getConnection();
    requireAuth();

    if ($method === 'GET' && $action === 'donaciones') {
        $rows = $pdo->query("
            SELECT d.*, a.nombre AS animal_nombre
            FROM donaciones d
            LEFT JOIN animales a ON d.id_animal = a.id_animal
            ORDER BY d.fecha_solicitud DESC
        ")->fetchAll();
        jsonResponse($rows);
    }

    if ($method === 'GET' && $action === 'voluntariados') {
        $rows = $pdo->query('SELECT * FROM voluntariados ORDER BY fecha_solicitud DESC')->fetchAll();
        jsonResponse($rows);
    }

    if ($method === 'PUT' && $action === 'donacion') {
        $id = (int) ($_GET['id'] ?? 0);
        $data = getJsonBody();
        $estado = $data['estado'] ?? '';
        if (!in_array($estado, ['Nueva', 'Contactada', 'Cerrada'], true)) {
            jsonResponse(['error' => 'Estado no válido'], 400);
        }
        $stmt = $pdo->prepare('UPDATE donaciones SET estado = ? WHERE id_donacion = ?');
        $stmt->execute([$estado, $id]);
        jsonResponse(['message' => 'Estado actualizado']);
    }

    if ($method === 'PUT' && $action === 'voluntariado') {
        $id = (int) ($_GET['id'] ?? 0);
        $data = getJsonBody();
        $estado = $data['estado'] ?? '';
        if (!in_array($estado, ['Nueva', 'Contactada', 'Activa', 'Cerrada'], true)) {
            jsonResponse(['error' => 'Estado no válido'], 400);
        }
        $stmt = $pdo->prepare('UPDATE voluntariados SET estado = ? WHERE id_voluntariado = ?');
        $stmt->execute([$estado, $id]);
        jsonResponse(['message' => 'Estado actualizado']);
    }

    jsonResponse(['error' => 'Acción no válida'], 405);
} catch (PDOException $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
