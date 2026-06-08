<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

try {
    requireAuth();
    $pdo = getConnection();

    if ($method === 'GET') {
        $stmt = $pdo->query("
            SELECT v.*, ad.certificado_codigo,
                   an.nombre AS animal,
                   CONCAT(ap.nombres,' ',ap.apellidos) AS adoptante,
                   ad.frecuencia_visitas
            FROM visitas_seguimiento v
            INNER JOIN adopciones ad ON v.id_adopcion = ad.id_adopcion
            INNER JOIN animales an ON ad.id_animal = an.id_animal
            INNER JOIN adoptantes ap ON ad.id_adoptante = ap.id_adoptante
            ORDER BY v.fecha_programada ASC
        ");
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'PUT' && $id) {
        $data = getJsonBody();
        $stmt = $pdo->prepare('
            UPDATE visitas_seguimiento SET
                fecha_realizada = ?, observaciones = ?, estado = ?
            WHERE id_visita = ?
        ');
        $stmt->execute([
            $data['fecha_realizada'] ?? date('Y-m-d'),
            $data['observaciones'] ?? null,
            $data['estado'] ?? 'Realizada',
            $id
        ]);

        $visita = $pdo->prepare('SELECT id_adopcion FROM visitas_seguimiento WHERE id_visita = ?');
        $visita->execute([$id]);
        $v = $visita->fetch();

        if ($v && ($data['estado'] ?? '') === 'Realizada') {
            $ad = $pdo->prepare('SELECT frecuencia_visitas, fecha_adopcion FROM adopciones WHERE id_adopcion = ?');
            $ad->execute([$v['id_adopcion']]);
            $adopcion = $ad->fetch();
            if ($adopcion) {
                $proxima = calcularProximaVisita($data['fecha_realizada'] ?? date('Y-m-d'), $adopcion['frecuencia_visitas'] ?? 'Mensual');
                $pdo->prepare('UPDATE adopciones SET proxima_visita = ? WHERE id_adopcion = ?')
                    ->execute([$proxima, $v['id_adopcion']]);
                $pdo->prepare('INSERT INTO visitas_seguimiento (id_adopcion, fecha_programada) VALUES (?,?)')
                    ->execute([$v['id_adopcion'], $proxima]);
            }
        }

        jsonResponse(['message' => 'Visita actualizada']);
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
