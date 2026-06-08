<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

try {
    requireAuth();
    $pdo = getConnection();

    if ($method === 'GET' && $id) {
        $stmt = $pdo->prepare('SELECT * FROM adoptantes WHERE id_adoptante = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) jsonResponse(['error' => 'Adoptante no encontrado'], 404);
        jsonResponse($row);
    }

    if ($method === 'GET') {
        $stmt = $pdo->query('SELECT * FROM adoptantes ORDER BY apellidos, nombres');
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST') {
        $data = getJsonBody();
        requireFields($data, ['nombres', 'apellidos', 'cedula']);

        $stmt = $pdo->prepare('
            INSERT INTO adoptantes (nombres, apellidos, cedula, telefono, correo, direccion)
            VALUES (?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $data['nombres'], $data['apellidos'], $data['cedula'],
            $data['telefono'] ?? null, $data['correo'] ?? null, $data['direccion'] ?? null
        ]);
        jsonResponse(['message' => 'Adoptante registrado', 'id' => $pdo->lastInsertId()], 201);
    }

    if ($method === 'PUT' && $id) {
        $data = getJsonBody();
        $stmt = $pdo->prepare('
            UPDATE adoptantes SET
                nombres = ?, apellidos = ?, cedula = ?, telefono = ?, correo = ?, direccion = ?
            WHERE id_adoptante = ?
        ');
        $stmt->execute([
            $data['nombres'], $data['apellidos'], $data['cedula'],
            $data['telefono'], $data['correo'], $data['direccion'], $id
        ]);
        if ($stmt->rowCount() === 0) jsonResponse(['error' => 'Adoptante no encontrado'], 404);
        jsonResponse(['message' => 'Adoptante actualizado correctamente']);
    }

    if ($method === 'DELETE' && $id) {
        $check = $pdo->prepare('SELECT id_adopcion FROM adopciones WHERE id_adoptante = ?');
        $check->execute([$id]);
        if ($check->fetch()) {
            jsonResponse(['error' => 'No se puede eliminar: el adoptante tiene adopciones registradas'], 400);
        }

        $stmt = $pdo->prepare('DELETE FROM adoptantes WHERE id_adoptante = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) jsonResponse(['error' => 'Adoptante no encontrado'], 404);
        jsonResponse(['message' => 'Adoptante eliminado correctamente']);
    }

    jsonResponse(['error' => 'Método no permitido'], 405);
} catch (PDOException $e) {
    if ($e->getCode() == 23000) {
        jsonResponse(['error' => 'Ya existe un adoptante con esa cédula'], 400);
    }
    jsonResponse(['error' => $e->getMessage()], 500);
}
