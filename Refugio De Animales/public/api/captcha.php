<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $a = random_int(1, 12);
    $b = random_int(1, 12);
    $_SESSION['captcha_answer'] = $a + $b;
    $_SESSION['captcha_time'] = time();

    jsonResponse([
        'pregunta' => "¿Cuánto es $a + $b?",
        'token' => bin2hex(random_bytes(8))
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = getJsonBody();
    $answer = (int)($data['respuesta'] ?? -1);
    $expected = $_SESSION['captcha_answer'] ?? null;
    $time = $_SESSION['captcha_time'] ?? 0;

    if (!$expected || (time() - $time) > 600) {
        jsonResponse(['valid' => false, 'error' => 'Captcha expirado. Recargue e intente de nuevo.'], 400);
    }

    if ($answer !== (int)$expected) {
        jsonResponse(['valid' => false, 'error' => 'Respuesta incorrecta del antibot.'], 400);
    }

    $_SESSION['captcha_verified'] = true;
    $_SESSION['captcha_verified_at'] = time();
    unset($_SESSION['captcha_answer']);

    jsonResponse(['valid' => true]);
}

jsonResponse(['error' => 'Método no permitido'], 405);
