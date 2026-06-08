<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mail_helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

function asegurarEstadosApoyos(PDO $pdo): void
{
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        $pdo->exec("ALTER TABLE donaciones MODIFY estado ENUM('Nueva','Contactada','Aceptada','Rechazada','Cerrada') DEFAULT 'Nueva'");
    } catch (PDOException $e) { /* ya aplicado */ }
    try {
        $pdo->exec("ALTER TABLE voluntariados MODIFY estado ENUM('Nueva','Contactada','Activa','Aceptada','Rechazada','Cerrada') DEFAULT 'Nueva'");
    } catch (PDOException $e) { /* ya aplicado */ }
}

function obtenerDonacion(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare("
        SELECT d.*, a.nombre AS animal_nombre
        FROM donaciones d
        LEFT JOIN animales a ON d.id_animal = a.id_animal
        WHERE d.id_donacion = ?
    ");
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

function obtenerVoluntariado(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM voluntariados WHERE id_voluntariado = ?');
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

function puedeGestionarApoyo(string $estado): bool
{
    return in_array($estado, ['Nueva', 'Contactada'], true);
}

try {
    $pdo = getConnection();
    requireAuth();
    asegurarEstadosApoyos($pdo);

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

    if ($method === 'POST' && $action === 'aceptar-donacion') {
        $data = getJsonBody();
        $id = (int) ($data['id_donacion'] ?? $_GET['id'] ?? 0);
        $row = obtenerDonacion($pdo, $id);
        if (!$row) jsonResponse(['error' => 'Solicitud no encontrada'], 404);
        if (!puedeGestionarApoyo($row['estado'])) {
            jsonResponse(['error' => 'Esta solicitud ya fue procesada'], 400);
        }

        $pdo->prepare("UPDATE donaciones SET estado = 'Aceptada' WHERE id_donacion = ?")->execute([$id]);
        $tipo = $row['tipo'] === 'Apadrinamiento' ? 'Apadrinamiento' : 'Donacion';
        $email = notificarApoyoAceptado($tipo, $row, $row['animal_nombre'] ?? null);

        jsonResponse([
            'message' => 'Solicitud aceptada.',
            'email' => $email
        ]);
    }

    if ($method === 'POST' && $action === 'rechazar-donacion') {
        $data = getJsonBody();
        $id = (int) ($data['id_donacion'] ?? $_GET['id'] ?? 0);
        $row = obtenerDonacion($pdo, $id);
        if (!$row) jsonResponse(['error' => 'Solicitud no encontrada'], 404);
        if (!puedeGestionarApoyo($row['estado'])) {
            jsonResponse(['error' => 'Esta solicitud ya fue procesada'], 400);
        }

        $pdo->prepare("UPDATE donaciones SET estado = 'Rechazada' WHERE id_donacion = ?")->execute([$id]);
        $tipo = $row['tipo'] === 'Apadrinamiento' ? 'Apadrinamiento' : 'Donacion';
        $email = notificarApoyoRechazado($tipo, $row, $row['animal_nombre'] ?? null);

        jsonResponse([
            'message' => 'Solicitud rechazada.',
            'email' => $email
        ]);
    }

    if ($method === 'POST' && $action === 'aceptar-voluntariado') {
        $data = getJsonBody();
        $id = (int) ($data['id_voluntariado'] ?? $_GET['id'] ?? 0);
        $row = obtenerVoluntariado($pdo, $id);
        if (!$row) jsonResponse(['error' => 'Solicitud no encontrada'], 404);
        if (!puedeGestionarApoyo($row['estado'])) {
            jsonResponse(['error' => 'Esta solicitud ya fue procesada'], 400);
        }

        $pdo->prepare("UPDATE voluntariados SET estado = 'Activa' WHERE id_voluntariado = ?")->execute([$id]);
        $email = notificarApoyoAceptado('Voluntariado', $row);

        jsonResponse([
            'message' => 'Voluntariado aceptado.',
            'email' => $email
        ]);
    }

    if ($method === 'POST' && $action === 'rechazar-voluntariado') {
        $data = getJsonBody();
        $id = (int) ($data['id_voluntariado'] ?? $_GET['id'] ?? 0);
        $row = obtenerVoluntariado($pdo, $id);
        if (!$row) jsonResponse(['error' => 'Solicitud no encontrada'], 404);
        if (!puedeGestionarApoyo($row['estado'])) {
            jsonResponse(['error' => 'Esta solicitud ya fue procesada'], 400);
        }

        $pdo->prepare("UPDATE voluntariados SET estado = 'Rechazada' WHERE id_voluntariado = ?")->execute([$id]);
        $email = notificarApoyoRechazado('Voluntariado', $row);

        jsonResponse([
            'message' => 'Voluntariado rechazado.',
            'email' => $email
        ]);
    }

    if ($method === 'DELETE' && $action === 'donacion') {
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $pdo->prepare('DELETE FROM donaciones WHERE id_donacion = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) jsonResponse(['error' => 'Solicitud no encontrada'], 404);
        jsonResponse(['message' => 'Solicitud eliminada']);
    }

    if ($method === 'DELETE' && $action === 'voluntariado') {
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $pdo->prepare('DELETE FROM voluntariados WHERE id_voluntariado = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) jsonResponse(['error' => 'Solicitud no encontrada'], 404);
        jsonResponse(['message' => 'Solicitud eliminada']);
    }

    if ($method === 'PUT' && $action === 'donacion') {
        $id = (int) ($_GET['id'] ?? 0);
        $data = getJsonBody();
        $estado = $data['estado'] ?? '';
        if (!in_array($estado, ['Nueva', 'Contactada', 'Aceptada', 'Rechazada', 'Cerrada'], true)) {
            jsonResponse(['error' => 'Estado no válido'], 400);
        }
        $pdo->prepare('UPDATE donaciones SET estado = ? WHERE id_donacion = ?')->execute([$estado, $id]);
        jsonResponse(['message' => 'Estado actualizado']);
    }

    if ($method === 'PUT' && $action === 'voluntariado') {
        $id = (int) ($_GET['id'] ?? 0);
        $data = getJsonBody();
        $estado = $data['estado'] ?? '';
        if (!in_array($estado, ['Nueva', 'Contactada', 'Activa', 'Aceptada', 'Rechazada', 'Cerrada'], true)) {
            jsonResponse(['error' => 'Estado no válido'], 400);
        }
        $pdo->prepare('UPDATE voluntariados SET estado = ? WHERE id_voluntariado = ?')->execute([$estado, $id]);
        jsonResponse(['message' => 'Estado actualizado']);
    }

    jsonResponse(['error' => 'Acción no válida'], 405);
} catch (PDOException $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
