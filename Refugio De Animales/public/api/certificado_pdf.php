<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/certificado_helpers.php';

$codigo = $_GET['codigo'] ?? null;
if (!$codigo) {
    http_response_code(400);
    echo 'Código requerido';
    exit;
}

try {
    $pdo = getConnection();
    $d = obtenerDatosCertificado($pdo, $codigo);
    if (!$d) {
        http_response_code(404);
        echo 'Certificado no encontrado';
        exit;
    }

    $path = generarPdfCertificado($d);

    if (!$path || !is_readable($path)) {
        http_response_code(500);
        echo 'No se pudo generar el PDF';
        exit;
    }

    $downloadName = nombreArchivoCertificado($d, true);

    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $downloadName . '"');
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: no-store');
    readfile($path);
} catch (Throwable $e) {
    http_response_code(500);
    echo 'Error: ' . $e->getMessage();
}
