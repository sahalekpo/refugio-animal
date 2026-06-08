<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Método no permitido'], 405);
}

requireAuth();

$uploaded = [];
$errors = [];

if (!empty($_FILES['fotos'])) {
    $files = $_FILES['fotos'];
    $count = is_array($files['name']) ? count($files['name']) : 1;

    $dir = dirname(__DIR__) . '/uploads';
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    for ($i = 0; $i < $count; $i++) {
        $name = is_array($files['name']) ? $files['name'][$i] : $files['name'];
        $tmp = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
        $type = is_array($files['type']) ? $files['type'][$i] : $files['type'];
        $err = is_array($files['error']) ? $files['error'][$i] : $files['error'];

        if ($err !== UPLOAD_ERR_OK) continue;
        if (!in_array($type, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true)) {
            $errors[] = "$name: formato no permitido";
            continue;
        }

        $ext = pathinfo($name, PATHINFO_EXTENSION) ?: 'jpg';
        $filename = 'animal_' . time() . '_' . bin2hex(random_bytes(3)) . "_$i." . strtolower($ext);
        if (move_uploaded_file($tmp, "$dir/$filename")) {
            $uploaded[] = 'uploads/' . $filename;
        }
    }
}

if (!empty($_FILES['foto']) && $_FILES['foto']['error'] === UPLOAD_ERR_OK) {
    $dir = dirname(__DIR__) . '/uploads';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $ext = pathinfo($_FILES['foto']['name'], PATHINFO_EXTENSION) ?: 'jpg';
    $filename = 'animal_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . strtolower($ext);
    if (move_uploaded_file($_FILES['foto']['tmp_name'], "$dir/$filename")) {
        $uploaded[] = 'uploads/' . $filename;
    }
}

if (empty($uploaded) && !empty($errors)) {
    jsonResponse(['error' => implode('; ', $errors)], 400);
}

jsonResponse(['fotos' => $uploaded, 'foto' => $uploaded[0] ?? null, 'message' => count($uploaded) . ' imagen(es) subida(s)']);
