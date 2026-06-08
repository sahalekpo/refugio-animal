<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/certificado_helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;
$id     = $_GET['id'] ?? null;

try {
    requireAuth();
    $pdo = getConnection();

    if ($method === 'GET') {
        $stmt = $pdo->query("
            SELECT ad.id_adopcion, ad.fecha_adopcion, ad.frecuencia_visitas, ad.proxima_visita,
                   ad.certificado_codigo, ad.id_animal, ad.id_adoptante, ad.id_empleado,
                   vw.animal, vw.adoptante, vw.empleado
            FROM vw_historial_adopciones vw
            INNER JOIN adopciones ad ON ad.id_adopcion = vw.id_adopcion
            ORDER BY ad.fecha_adopcion DESC
        ");
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST' && $action === 'manual') {
        $data = getJsonBody();
        requireFields($data, ['id_animal', 'id_adoptante', 'id_empleado', 'fecha_adopcion', 'frecuencia_visitas']);

        $animal = $pdo->prepare('
            SELECT a.id_animal, es.nombre_estado FROM animales a
            INNER JOIN estados es ON a.id_estado = es.id_estado WHERE a.id_animal = ?
        ');
        $animal->execute([$data['id_animal']]);
        $a = $animal->fetch();
        if (!$a) jsonResponse(['error' => 'Animal no encontrado'], 404);

        $codigo = 'CERT-' . date('Y') . '-' . str_pad(random_int(1, 99999), 5, '0', STR_PAD_LEFT);
        $proxima = calcularProximaVisita($data['fecha_adopcion'], $data['frecuencia_visitas']);

        $pdo->prepare('
            INSERT INTO adopciones (id_animal, id_adoptante, id_empleado, fecha_adopcion, frecuencia_visitas, certificado_codigo, proxima_visita)
            VALUES (?,?,?,?,?,?,?)
        ')->execute([
            $data['id_animal'], $data['id_adoptante'], $data['id_empleado'],
            $data['fecha_adopcion'], $data['frecuencia_visitas'], $codigo, $proxima
        ]);

        $idAdopcion = $pdo->lastInsertId();
        $pdo->prepare('INSERT INTO visitas_seguimiento (id_adopcion, fecha_programada, estado) VALUES (?,?,?)')
            ->execute([$idAdopcion, $proxima, 'Programada']);

        $cert = emitirCertificadoCompleto($pdo, $codigo);

        jsonResponse([
            'message' => 'Adopción registrada',
            'certificado_codigo' => $codigo,
            'certificado_url' => $cert['certificado_url'] ?? ('certificado.html?codigo=' . urlencode($codigo)),
            'certificado_pdf' => $cert['pdf_api'] ?? null,
            'email' => $cert['email'] ?? null
        ], 201);
    }

    if ($method === 'DELETE' && $id) {
        $ad = $pdo->prepare('SELECT id_animal FROM adopciones WHERE id_adopcion = ?');
        $ad->execute([$id]);
        $row = $ad->fetch();
        if (!$row) jsonResponse(['error' => 'Adopción no encontrada'], 404);

        $pdo->prepare('DELETE FROM visitas_seguimiento WHERE id_adopcion = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM adopciones WHERE id_adopcion = ?')->execute([$id]);

        $idDisponible = $pdo->query("SELECT id_estado FROM estados WHERE nombre_estado = 'Disponible'")->fetchColumn();
        $pdo->prepare('UPDATE animales SET id_estado = ? WHERE id_animal = ?')
            ->execute([$idDisponible, $row['id_animal']]);

        jsonResponse(['message' => 'Adopción eliminada. Animal disponible nuevamente.']);
    }

    jsonResponse(['error' => 'Método no permitido'], 405);
} catch (PDOException $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}

function calcularProximaVisita($fecha, $frecuencia) {
    $d = new DateTime($fecha);
    switch ($frecuencia) {
        case 'Semanal': $d->modify('+1 week'); break;
        case 'Quincenal': $d->modify('+2 weeks'); break;
        case 'Mensual': default: $d->modify('+1 month'); break;
        case 'Trimestral': $d->modify('+3 months'); break;
    }
    return $d->format('Y-m-d');
}
