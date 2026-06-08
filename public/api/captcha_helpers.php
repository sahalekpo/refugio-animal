<?php
require_once __DIR__ . '/config.php';

function verifyCaptchaAndBot($data) {
    if (!empty($data['website'])) {
        jsonResponse(['error' => 'Solicitud bloqueada (antibot).'], 403);
    }
    if (empty($_SESSION['captcha_verified']) ||
        (time() - ($_SESSION['captcha_verified_at'] ?? 0)) > 900) {
        jsonResponse(['error' => 'Debe completar la verificación antibot.'], 403);
    }
    unset($_SESSION['captcha_verified']);
}
