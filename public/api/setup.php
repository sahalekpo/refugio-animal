<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true) ?: [];

$host = trim($data['host'] ?? 'localhost');
$user = trim($data['user'] ?? 'root');
$pass = $data['pass'] ?? '';
$name = trim($data['name'] ?? 'refugio_animales');
$action = $data['action'] ?? 'test';

function respond($payload, $code = 200) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function tryConnect($host, $user, $pass, $db = null) {
    $dsn = $db
        ? "mysql:host=$host;dbname=$db;charset=utf8mb4"
        : "mysql:host=$host;charset=utf8mb4";
    return new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
}

function saveConfig($host, $user, $pass, $name) {
    $path = __DIR__ . '/db.local.php';
    $passEscaped = str_replace("'", "\\'", $pass);
    $content = "<?php\nreturn [\n"
        . "    'host' => '$host',\n"
        . "    'user' => '$user',\n"
        . "    'pass' => '$passEscaped',\n"
        . "    'name' => '$name'\n"
        . "];\n";
    if (file_put_contents($path, $content) === false) {
        respond(['error' => 'No se pudo guardar db.local.php. Verifique permisos.'], 500);
    }
}

try {
    if ($action === 'test' || $action === 'save') {
        $pdo = tryConnect($host, $user, $pass);

        $dbExists = false;
        $tables = [];
        $stmt = $pdo->query("SHOW DATABASES LIKE " . $pdo->quote($name));
        if ($stmt->fetch()) {
            $dbExists = true;
            $pdoDb = tryConnect($host, $user, $pass, $name);
            $tablesResult = $pdoDb->query('SHOW TABLES');
            $tables = $tablesResult->fetchAll(PDO::FETCH_COLUMN);
        }

        $required = ['animales', 'adoptantes', 'empleados', 'adopciones', 'estados', 'especies'];
        $missing = array_values(array_diff($required, $tables));

        $result = [
            'ok' => true,
            'message' => 'Conexión exitosa con MySQL',
            'database_exists' => $dbExists,
            'tables_found' => count($tables),
            'tables' => $tables,
            'missing_tables' => $missing,
            'ready' => $dbExists && count($missing) === 0
        ];

        if ($action === 'save') {
            saveConfig($host, $user, $pass, $name);
            $result['saved'] = true;
            $result['message'] = $result['ready']
                ? 'Configuración guardada. La base de datos está lista.'
                : 'Configuración guardada. Falta importar las tablas en MySQL Workbench.';
        }

        respond($result);
    }

    respond(['error' => 'Acción no válida'], 400);
} catch (PDOException $e) {
    $msg = $e->getMessage();
    if (str_contains($msg, '1045')) {
        $msg = 'Contraseña incorrecta o usuario no autorizado. Use la misma contraseña de MySQL Workbench.';
    } elseif (str_contains($msg, '2002') || str_contains($msg, '2003')) {
        $msg = 'No se pudo conectar al servidor MySQL. Verifique que el servicio MySQL80 esté encendido.';
    } elseif (str_contains($msg, '1049')) {
        $msg = "La base de datos '$name' no existe. Créela e importe database.sql desde MySQL Workbench.";
    }
    respond(['ok' => false, 'error' => $msg], 400);
}
