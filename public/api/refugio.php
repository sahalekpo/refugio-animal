<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = getConnection();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->query('SELECT * FROM refugio_info WHERE id = 1');
        $row = $stmt->fetch();
        if (!$row) {
            jsonResponse([
                'nombre' => 'Refugio de Animales',
                'descripcion' => '',
                'mision' => '',
                'correo' => '',
                'telefono' => '',
                'direccion' => '',
                'horario' => ''
            ]);
        }
        jsonResponse($row);
    }
    jsonResponse(['error' => 'Método no permitido'], 405);
} catch (PDOException $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
