<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');
$origin = $_SERVER['HTTP_ORIGIN'] ?? null;
if ($origin && preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header('Access-Control-Allow-Origin: http://localhost:8080');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function requireAuth() {
    if (empty($_SESSION['user_id'])) {
        jsonResponse(['error' => 'Sesión no válida. Inicie sesión.', 'redirect' => 'login.html'], 401);
    }
}

function getAuthUser() {
    return $_SESSION['user'] ?? null;
}

function getConnection() {
    static $pdo = null;
    if ($pdo === null) {
        $local = __DIR__ . '/db.local.php';
        if (file_exists($local)) {
            $cfg = require $local;
            $host = $cfg['host'];
            $db   = $cfg['name'];
            $user = $cfg['user'];
            $pass = $cfg['pass'];
        } else {
            $host = getenv('DB_HOST') ?: 'localhost';
            $db   = getenv('DB_NAME') ?: 'refugio_animales';
            $user = getenv('DB_USER') ?: 'root';
            $pass = getenv('DB_PASSWORD') ?: '';
        }
        $dsn  = "mysql:host=$host;dbname=$db;charset=utf8mb4";
        $pdo  = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    }
    return $pdo;
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonBody() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function requireFields($data, $fields) {
    foreach ($fields as $field) {
        if (!isset($data[$field]) || $data[$field] === '' || $data[$field] === null) {
            jsonResponse(['error' => "Campo obligatorio: $field"], 400);
        }
    }
}

function normalizeBody(array &$data) {
    foreach (['id_especie', 'id_estado', 'id_animal', 'id_adoptante', 'id_empleado', 'id_postulacion', 'edad', 'adultos_hogar', 'ninos_hogar'] as $k) {
        if (isset($data[$k]) && $data[$k] !== '' && $data[$k] !== null) {
            $data[$k] = (int) $data[$k];
        } elseif (isset($data[$k]) && $data[$k] === '') {
            unset($data[$k]);
        }
    }
}

function getEstadoId(PDO $pdo, $nombre) {
    $stmt = $pdo->prepare('SELECT id_estado FROM estados WHERE nombre_estado = ?');
    $stmt->execute([$nombre]);
    $row = $stmt->fetch();
    return $row ? (int) $row['id_estado'] : 1;
}

function guardarFotosAnimal(PDO $pdo, $idAnimal, array $rutas) {
    if (empty($rutas)) return;
    $orden = 0;
    foreach ($rutas as $ruta) {
        if (!$ruta) continue;
        $pdo->prepare('INSERT INTO animal_fotos (id_animal, ruta, orden) VALUES (?, ?, ?)')
            ->execute([$idAnimal, $ruta, $orden++]);
        if ($orden === 1) {
            $pdo->prepare('UPDATE animales SET foto = ? WHERE id_animal = ?')->execute([$ruta, $idAnimal]);
        }
    }
}

function fotosAnimal(PDO $pdo, $idAnimal) {
    $stmt = $pdo->prepare('SELECT id_foto, ruta, orden FROM animal_fotos WHERE id_animal = ? ORDER BY orden, id_foto');
    $stmt->execute([$idAnimal]);
    return $stmt->fetchAll();
}

function especiesPermitidas(): array
{
    return ['Perro', 'Gato'];
}

function assertEspeciePermitida(PDO $pdo, int $idEspecie): void
{
    $stmt = $pdo->prepare('SELECT nombre_especie FROM especies WHERE id_especie = ?');
    $stmt->execute([$idEspecie]);
    $row = $stmt->fetch();
    if (!$row || !in_array($row['nombre_especie'], especiesPermitidas(), true)) {
        jsonResponse(['error' => 'Solo se permiten perros y gatos'], 400);
    }
}

function perfilAnimalDesdeBody(array $data): array
{
    return [
        'vacunado' => in_array($data['vacunado'] ?? 'No', ['Si', 'No'], true) ? $data['vacunado'] : 'No',
        'esterilizado' => in_array($data['esterilizado'] ?? 'No', ['Si', 'No'], true) ? $data['esterilizado'] : 'No',
        'desparasitado' => in_array($data['desparasitado'] ?? 'No', ['Si', 'No'], true) ? $data['desparasitado'] : 'No',
        'compatible_ninos' => in_array($data['compatible_ninos'] ?? 'Desconocido', ['Si', 'No', 'Desconocido'], true)
            ? $data['compatible_ninos'] : 'Desconocido',
        'compatible_mascotas' => in_array($data['compatible_mascotas'] ?? 'Desconocido', ['Si', 'No', 'Desconocido'], true)
            ? $data['compatible_mascotas'] : 'Desconocido',
        'nivel_energia' => in_array($data['nivel_energia'] ?? 'Media', ['Baja', 'Media', 'Alta'], true)
            ? $data['nivel_energia'] : 'Media',
    ];
}
