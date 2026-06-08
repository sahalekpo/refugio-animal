<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

try {
    requireAuth();
    $pdo = getConnection();

    if ($method === 'GET' && $id) {
        $stmt = $pdo->prepare('SELECT * FROM empleados WHERE id_empleado = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) jsonResponse(['error' => 'Empleado no encontrado'], 404);
        jsonResponse($row);
    }

    if ($method === 'GET') {
        $stmt = $pdo->query('SELECT * FROM empleados ORDER BY apellidos, nombres');
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST') {
        $data = getJsonBody();
        requireFields($data, ['nombres', 'apellidos']);

        $stmt = $pdo->prepare('
            INSERT INTO empleados (nombres, apellidos, cargo, telefono, correo)
            VALUES (?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $data['nombres'], $data['apellidos'],
            $data['cargo'] ?? null, $data['telefono'] ?? null, $data['correo'] ?? null
        ]);
        jsonResponse(['message' => 'Empleado registrado', 'id' => $pdo->lastInsertId()], 201);
    }

    if ($method === 'PUT' && $id) {
        $data = getJsonBody();
        $stmt = $pdo->prepare('
            UPDATE empleados SET
                nombres = ?, apellidos = ?, cargo = ?, telefono = ?, correo = ?
            WHERE id_empleado = ?
        ');
        $stmt->execute([
            $data['nombres'], $data['apellidos'], $data['cargo'],
            $data['telefono'], $data['correo'], $id
        ]);
        if ($stmt->rowCount() === 0) jsonResponse(['error' => 'Empleado no encontrado'], 404);
        jsonResponse(['message' => 'Empleado actualizado correctamente']);
    }

    if ($method === 'DELETE' && $id) {
        $check = $pdo->prepare('SELECT id_adopcion FROM adopciones WHERE id_empleado = ?');
        $check->execute([$id]);
        if ($check->fetch()) {
            jsonResponse(['error' => 'No se puede eliminar: el empleado tiene adopciones registradas'], 400);
        }

        $stmt = $pdo->prepare('DELETE FROM empleados WHERE id_empleado = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) jsonResponse(['error' => 'Empleado no encontrado'], 404);
        jsonResponse(['message' => 'Empleado eliminado correctamente']);
    }

    jsonResponse(['error' => 'Método no permitido'], 405);
} catch (PDOException $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
