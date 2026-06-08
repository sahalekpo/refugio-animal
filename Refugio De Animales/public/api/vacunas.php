<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

try {
    requireAuth();
    $pdo = getConnection();

    if ($method === 'GET') {
        $stmt = $pdo->query("
            SELECT v.*, a.nombre AS animal, e.nombre_especie
            FROM vacunas v
            INNER JOIN animales a ON v.id_animal = a.id_animal
            INNER JOIN especies e ON a.id_especie = e.id_especie
            ORDER BY v.fecha_proxima ASC
        ");
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST') {
        $data = getJsonBody();
        requireFields($data, ['id_animal', 'nombre_vacuna', 'fecha_proxima']);
        normalizeBody($data);

        $pdo->prepare('
            INSERT INTO vacunas (id_animal, nombre_vacuna, fecha_aplicada, fecha_proxima, observaciones, estado)
            VALUES (?, ?, ?, ?, ?, ?)
        ')->execute([
            $data['id_animal'],
            $data['nombre_vacuna'],
            $data['fecha_aplicada'] ?? null,
            $data['fecha_proxima'],
            $data['observaciones'] ?? null,
            $data['estado'] ?? 'Pendiente'
        ]);

        jsonResponse(['message' => 'Vacuna registrada'], 201);
    }

    if ($method === 'PUT' && $id) {
        $data = getJsonBody();
        $pdo->prepare('
            UPDATE vacunas SET nombre_vacuna=?, fecha_aplicada=?, fecha_proxima=?, observaciones=?, estado=?
            WHERE id_vacuna=?
        ')->execute([
            $data['nombre_vacuna'], $data['fecha_aplicada'] ?? null, $data['fecha_proxima'],
            $data['observaciones'] ?? null, $data['estado'] ?? 'Pendiente', $id
        ]);
        jsonResponse(['message' => 'Vacuna actualizada']);
    }

    if ($method === 'DELETE' && $id) {
        $pdo->prepare('DELETE FROM vacunas WHERE id_vacuna = ?')->execute([$id]);
        jsonResponse(['message' => 'Vacuna eliminada']);
    }

    jsonResponse(['error' => 'Método no permitido'], 405);
} catch (PDOException $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
