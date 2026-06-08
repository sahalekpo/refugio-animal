<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/captcha_helpers.php';
require_once __DIR__ . '/certificado_helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    $pdo = getConnection();

    if ($method === 'GET' && $action === 'public') {
        $stmt = $pdo->query("
            SELECT p.*, a.nombre AS animal, e.nombre_especie
            FROM postulaciones p
            INNER JOIN animales a ON p.id_animal = a.id_animal
            INNER JOIN especies e ON a.id_especie = e.id_especie
            WHERE p.estado_postulacion = 'Pendiente'
            ORDER BY p.fecha_postulacion DESC
        ");
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'GET') {
        requireAuth();
        $stmt = $pdo->query("
            SELECT p.*, a.nombre AS animal, e.nombre_especie, es.nombre_estado
            FROM postulaciones p
            INNER JOIN animales a ON p.id_animal = a.id_animal
            INNER JOIN especies e ON a.id_especie = e.id_especie
            INNER JOIN estados es ON a.id_estado = es.id_estado
            ORDER BY p.fecha_postulacion DESC
        ");
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST' && $action === 'postular') {
        $data = getJsonBody();
        verifyCaptchaAndBot($data);

        requireFields($data, [
            'id_animal', 'nombres', 'apellidos', 'cedula', 'tipo_vivienda',
            'tiene_patio', 'experiencia_mascotas', 'otras_mascotas',
            'motivo_adopcion', 'acepta_visitas'
        ]);

        $stmt = $pdo->prepare('
            SELECT a.id_animal, es.nombre_estado, e.nombre_especie
            FROM animales a
            INNER JOIN estados es ON a.id_estado = es.id_estado
            INNER JOIN especies e ON a.id_especie = e.id_especie
            WHERE a.id_animal = ?
        ');
        $stmt->execute([$data['id_animal']]);
        $animal = $stmt->fetch();

        if (!$animal) jsonResponse(['error' => 'Animal no encontrado'], 404);
        if (!in_array($animal['nombre_especie'], especiesPermitidas(), true)) {
            jsonResponse(['error' => 'Solo se pueden adoptar perros y gatos'], 400);
        }
        if ($animal['nombre_estado'] !== 'Disponible') {
            jsonResponse(['error' => 'Este animal ya no está disponible para postulación'], 400);
        }

        $pdo->prepare('
            INSERT INTO postulaciones (
                id_animal, nombres, apellidos, cedula, telefono, correo, direccion,
                tipo_vivienda, tiene_patio, adultos_hogar, ninos_hogar,
                experiencia_mascotas, otras_mascotas, detalle_otras_mascotas,
                motivo_adopcion, tiempo_disponible, acepta_visitas
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ')->execute([
            $data['id_animal'], $data['nombres'], $data['apellidos'], $data['cedula'],
            $data['telefono'] ?? null, $data['correo'] ?? null, $data['direccion'] ?? null,
            $data['tipo_vivienda'], $data['tiene_patio'],
            (int)($data['adultos_hogar'] ?? 0), (int)($data['ninos_hogar'] ?? 0),
            $data['experiencia_mascotas'], $data['otras_mascotas'],
            $data['detalle_otras_mascotas'] ?? null,
            $data['motivo_adopcion'], $data['tiempo_disponible'] ?? null,
            $data['acepta_visitas']
        ]);

        jsonResponse([
            'message' => 'Postulación enviada. El animal quedó en proceso de adopción.',
            'estado' => 'En proceso de adopción'
        ], 201);
    }

    if ($method === 'POST' && $action === 'aprobar') {
        requireAuth();
        $data = getJsonBody();
        normalizeBody($data);
        requireFields($data, ['id_postulacion', 'id_empleado', 'frecuencia_visitas']);

        $stmt = $pdo->prepare('SELECT * FROM postulaciones WHERE id_postulacion = ?');
        $stmt->execute([$data['id_postulacion']]);
        $post = $stmt->fetch();
        if (!$post) jsonResponse(['error' => 'Postulación no encontrada'], 404);
        if ($post['estado_postulacion'] !== 'Pendiente') {
            jsonResponse(['error' => 'Esta postulación ya fue procesada'], 400);
        }

        $existeAdopcion = $pdo->prepare('SELECT id_adopcion FROM adopciones WHERE id_animal = ?');
        $existeAdopcion->execute([$post['id_animal']]);
        if ($existeAdopcion->fetch()) {
            jsonResponse(['error' => 'Este animal ya tiene una adopción registrada'], 400);
        }

        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare('SELECT id_adoptante FROM adoptantes WHERE cedula = ?');
            $stmt->execute([$post['cedula']]);
            $adoptante = $stmt->fetch();

            if ($adoptante) {
                $idAdoptante = (int) $adoptante['id_adoptante'];
                $pdo->prepare('UPDATE adoptantes SET nombres=?, apellidos=?, telefono=?, correo=?, direccion=? WHERE id_adoptante=?')
                    ->execute([$post['nombres'], $post['apellidos'], $post['telefono'], $post['correo'], $post['direccion'], $idAdoptante]);
            } else {
                $pdo->prepare('INSERT INTO adoptantes (nombres, apellidos, cedula, telefono, correo, direccion) VALUES (?,?,?,?,?,?)')
                    ->execute([$post['nombres'], $post['apellidos'], $post['cedula'], $post['telefono'], $post['correo'], $post['direccion']]);
                $idAdoptante = (int) $pdo->lastInsertId();
            }

            $codigo = 'CERT-' . date('Y') . '-' . str_pad((string) $post['id_postulacion'], 5, '0', STR_PAD_LEFT);
            $fecha = date('Y-m-d');
            $freq = $data['frecuencia_visitas'];
            $proxima = calcularProximaVisita($fecha, $freq);

            $pdo->prepare('
                INSERT INTO adopciones (id_animal, id_adoptante, id_empleado, fecha_adopcion, frecuencia_visitas, certificado_codigo, proxima_visita)
                VALUES (?,?,?,?,?,?,?)
            ')->execute([
                $post['id_animal'], $idAdoptante, $data['id_empleado'], $fecha, $freq, $codigo, $proxima
            ]);

            $idAdopcion = (int) $pdo->lastInsertId();
            if ($idAdopcion <= 0) {
                throw new RuntimeException('No se pudo registrar la adopción');
            }

            $pdo->prepare('INSERT INTO visitas_seguimiento (id_adopcion, fecha_programada, estado) VALUES (?,?,?)')
                ->execute([$idAdopcion, $proxima, 'Programada']);

            $pdo->prepare("UPDATE postulaciones SET estado_postulacion = 'Aprobada' WHERE id_postulacion = ?")
                ->execute([$data['id_postulacion']]);

            $pdo->prepare("
                UPDATE postulaciones SET estado_postulacion = 'Rechazada'
                WHERE id_animal = ? AND id_postulacion != ? AND estado_postulacion = 'Pendiente'
            ")->execute([$post['id_animal'], $data['id_postulacion']]);

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $cert = emitirCertificadoCompleto($pdo, $codigo);

        jsonResponse([
            'message' => 'Adopción aprobada. Certificado disponible para el adoptante.',
            'certificado_codigo' => $codigo,
            'portal_adoptante' => 'usuario.html#mi-solicitud',
            'correo_adoptante' => $post['correo'] ?? null,
            'email' => $cert['email'] ?? ['sent' => false, 'message' => '']
        ], 201);
    }

    if ($method === 'POST' && $action === 'rechazar') {
        requireAuth();
        $data = getJsonBody();
        normalizeBody($data);
        requireFields($data, ['id_postulacion']);

        $stmt = $pdo->prepare('SELECT * FROM postulaciones WHERE id_postulacion = ?');
        $stmt->execute([$data['id_postulacion']]);
        $post = $stmt->fetch();
        if (!$post) jsonResponse(['error' => 'Postulación no encontrada'], 404);

        $pdo->prepare("UPDATE postulaciones SET estado_postulacion = 'Rechazada' WHERE id_postulacion = ?")
            ->execute([$data['id_postulacion']]);

        $idDisponible = $pdo->query("SELECT id_estado FROM estados WHERE nombre_estado = 'Disponible'")->fetchColumn();
        $pdo->prepare('UPDATE animales SET id_estado = ? WHERE id_animal = ?')
            ->execute([$idDisponible, $post['id_animal']]);

        jsonResponse(['message' => 'Postulación rechazada. Animal disponible nuevamente.']);
    }

    jsonResponse(['error' => 'Acción no válida'], 400);
} catch (PDOException $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
} catch (Throwable $e) {
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
