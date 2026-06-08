<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    if ($method === 'GET' && $action === 'check') {
        if (!empty($_SESSION['user_id'])) {
            jsonResponse(['authenticated' => true, 'user' => $_SESSION['user']]);
        }
        jsonResponse(['authenticated' => false]);
    }

    if ($method === 'POST' && $action === 'login') {
        $data = getJsonBody();
        requireFields($data, ['usuario', 'contrasena']);

        $pdo = getConnection();
        $stmt = $pdo->prepare('SELECT * FROM usuarios WHERE usuario = ?');
        $stmt->execute([$data['usuario']]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($data['contrasena'], $user['contrasena'])) {
            jsonResponse(['error' => 'Usuario o contraseña incorrectos'], 401);
        }

        $_SESSION['user_id'] = $user['id_usuario'];
        $_SESSION['user'] = [
            'id' => $user['id_usuario'],
            'usuario' => $user['usuario'],
            'rol' => $user['rol']
        ];

        jsonResponse(['message' => 'Sesión iniciada', 'user' => $_SESSION['user']]);
    }

    if ($method === 'POST' && $action === 'logout') {
        session_destroy();
        jsonResponse(['message' => 'Sesión cerrada']);
    }

    jsonResponse(['error' => 'Acción no válida'], 400);
} catch (PDOException $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
