<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    $pdo = getConnection();

    if ($method === 'GET' && $action === 'animales') {
        $rows = $pdo->query('
            SELECT a.id_animal, a.nombre, e.nombre_especie, a.raza, a.sexo, a.edad,
                   a.fecha_ingreso, a.descripcion, a.foto, es.nombre_estado,
                   a.vacunado, a.esterilizado, a.desparasitado,
                   a.compatible_ninos, a.compatible_mascotas, a.nivel_energia
            FROM animales a
            INNER JOIN especies e ON a.id_especie = e.id_especie
            INNER JOIN estados es ON a.id_estado = es.id_estado
            WHERE es.nombre_estado = \'Disponible\'
              AND e.nombre_especie IN (\'Perro\', \'Gato\')
            ORDER BY a.fecha_ingreso DESC
        ')->fetchAll();

        $hoy = new DateTime('today');
        foreach ($rows as &$r) {
            $r['fotos'] = fotosAnimal($pdo, $r['id_animal']);
            if (empty($r['fotos']) && !empty($r['foto'])) {
                $r['fotos'] = [['ruta' => $r['foto'], 'orden' => 0]];
            }
            $ingreso = new DateTime($r['fecha_ingreso']);
            $r['dias_ingreso'] = (int) $hoy->diff($ingreso)->days;
            $r['es_nuevo'] = $r['dias_ingreso'] <= 30;
            $r['tiene_fotos'] = count($r['fotos']) > 0;
            $r['destacado'] = $r['es_nuevo'] || $r['tiene_fotos'];
        }
        unset($r);

        $destacados = array_values(array_filter($rows, fn($x) => $x['destacado']));
        if (empty($destacados)) {
            $destacados = array_slice($rows, 0, 6);
        } else {
            $destacados = array_slice($destacados, 0, 8);
        }

        $nuevos = array_values(array_filter($rows, fn($x) => $x['es_nuevo']));
        if (empty($nuevos)) {
            $nuevos = array_slice($rows, 0, min(6, count($rows)));
        }

        jsonResponse([
            'todos' => $rows,
            'destacados' => $destacados,
            'nuevos' => $nuevos,
            'total' => count($rows)
        ]);
    }

    if ($method === 'GET' && $action === 'adoptados') {
        $rows = $pdo->query('
            SELECT a.id_animal, a.nombre, a.descripcion, a.foto, a.raza,
                   e.nombre_especie, ad.fecha_adopcion
            FROM animales a
            INNER JOIN especies e ON a.id_especie = e.id_especie
            INNER JOIN estados es ON a.id_estado = es.id_estado
            INNER JOIN adopciones ad ON ad.id_animal = a.id_animal
            WHERE es.nombre_estado = \'Adoptado\'
              AND e.nombre_especie IN (\'Perro\', \'Gato\')
            ORDER BY ad.fecha_adopcion DESC
            LIMIT 12
        ')->fetchAll();

        foreach ($rows as &$r) {
            $r['fotos'] = fotosAnimal($pdo, $r['id_animal']);
            if (empty($r['fotos']) && !empty($r['foto'])) {
                $r['fotos'] = [['ruta' => $r['foto'], 'orden' => 0]];
            }
        }
        unset($r);

        jsonResponse($rows);
    }

    if ($method === 'GET' && $action === 'hero-imagenes') {
        $images = [];
        $heroDir = dirname(__DIR__) . '/img/hero';
        if (is_dir($heroDir)) {
            foreach (glob($heroDir . '/*.{jpg,jpeg,png,webp,gif}', GLOB_BRACE) ?: [] as $file) {
                $images[] = 'img/hero/' . basename($file);
            }
        }
        sort($images);

        if (count($images) < 3) {
            $rows = $pdo->query("
                SELECT DISTINCT COALESCE(af.ruta, a.foto) AS ruta
                FROM animales a
                LEFT JOIN animal_fotos af ON af.id_animal = a.id_animal
                INNER JOIN estados es ON a.id_estado = es.id_estado
                WHERE (af.ruta IS NOT NULL OR a.foto IS NOT NULL)
                ORDER BY a.fecha_ingreso DESC
                LIMIT 12
            ")->fetchAll();
            foreach ($rows as $r) {
                if (!empty($r['ruta']) && !in_array($r['ruta'], $images, true)) {
                    $images[] = $r['ruta'];
                }
            }
        }

        jsonResponse(['imagenes' => $images]);
    }

    if ($method === 'GET' && $action === 'stats') {
        $disponibles = (int) $pdo->query("
            SELECT COUNT(*) FROM animales a
            INNER JOIN estados e ON a.id_estado = e.id_estado
            WHERE e.nombre_estado = 'Disponible'
        ")->fetchColumn();
        $adoptados = (int) $pdo->query("
            SELECT COUNT(*) FROM animales a
            INNER JOIN estados e ON a.id_estado = e.id_estado
            WHERE e.nombre_estado = 'Adoptado'
        ")->fetchColumn();
        $total = (int) $pdo->query('SELECT COUNT(*) FROM animales')->fetchColumn();
        $postulaciones = (int) $pdo->query('SELECT COUNT(*) FROM postulaciones')->fetchColumn();

        jsonResponse([
            'disponibles' => $disponibles,
            'adoptados' => $adoptados,
            'total_animales' => $total,
            'postulaciones' => $postulaciones
        ]);
    }

    if ($method === 'GET' && $action === 'info') {
        $stmt = $pdo->query('SELECT * FROM refugio_info WHERE id = 1');
        jsonResponse($stmt->fetch() ?: []);
    }

    if ($method === 'GET' && $action === 'mi-solicitud') {
        $cedula = trim($_GET['cedula'] ?? '');
        if ($cedula === '') {
            jsonResponse(['error' => 'Ingrese su número de cédula'], 400);
        }

        $stmt = $pdo->prepare("
            SELECT p.id_postulacion, p.estado_postulacion, p.fecha_postulacion,
                   p.nombres, p.apellidos, a.nombre AS animal, e.nombre_especie,
                   ad.certificado_codigo, ad.fecha_adopcion, ad.proxima_visita
            FROM postulaciones p
            INNER JOIN animales a ON p.id_animal = a.id_animal
            INNER JOIN especies e ON a.id_especie = e.id_especie
            LEFT JOIN adoptantes ap ON ap.cedula = p.cedula
            LEFT JOIN adopciones ad ON ad.id_animal = p.id_animal AND ad.id_adoptante = ap.id_adoptante
            WHERE p.cedula = ?
            ORDER BY p.fecha_postulacion DESC
        ");
        $stmt->execute([$cedula]);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$r) {
            if ($r['estado_postulacion'] === 'Aprobada' && !empty($r['certificado_codigo'])) {
                $codigo = $r['certificado_codigo'];
                $r['certificado_url'] = 'certificado.html?codigo=' . urlencode($codigo);
                $r['certificado_pdf'] = 'api/certificado_pdf.php?codigo=' . urlencode($codigo);
            }
        }

        jsonResponse([
            'cedula' => $cedula,
            'postulaciones' => $rows
        ]);
    }

    if ($method === 'POST' && $action === 'donacion') {
        $data = getJsonBody();
        requireFields($data, ['nombres', 'tipo']);
        $tipo = in_array($data['tipo'], ['Donacion', 'Apadrinamiento'], true) ? $data['tipo'] : 'Donacion';
        $idAnimal = !empty($data['id_animal']) ? (int) $data['id_animal'] : null;

        if ($tipo === 'Apadrinamiento' && $idAnimal) {
            $chk = $pdo->prepare('SELECT id_animal FROM animales WHERE id_animal = ?');
            $chk->execute([$idAnimal]);
            if (!$chk->fetch()) {
                jsonResponse(['error' => 'Animal no encontrado para apadrinamiento'], 404);
            }
        }

        $pdo->prepare('
            INSERT INTO donaciones (tipo, nombres, correo, telefono, monto_sugerido, id_animal, mensaje)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ')->execute([
            $tipo,
            trim($data['nombres']),
            $data['correo'] ?? null,
            $data['telefono'] ?? null,
            $data['monto_sugerido'] ?? null,
            $tipo === 'Apadrinamiento' ? $idAnimal : null,
            $data['mensaje'] ?? null,
        ]);

        jsonResponse([
            'message' => $tipo === 'Apadrinamiento'
                ? 'Solicitud de apadrinamiento recibida. Nos pondremos en contacto pronto.'
                : 'Gracias por tu interés en apoyar al refugio. Te contactaremos pronto.',
        ], 201);
    }

    if ($method === 'POST' && $action === 'voluntariado') {
        $data = getJsonBody();
        requireFields($data, ['nombres', 'apellidos', 'correo', 'disponibilidad', 'areas_interes']);

        if (!filter_var($data['correo'], FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['error' => 'Correo electrónico no válido'], 400);
        }

        $pdo->prepare('
            INSERT INTO voluntariados (nombres, apellidos, correo, telefono, disponibilidad, areas_interes, experiencia, mensaje)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ')->execute([
            trim($data['nombres']),
            trim($data['apellidos']),
            trim($data['correo']),
            $data['telefono'] ?? null,
            trim($data['disponibilidad']),
            trim($data['areas_interes']),
            $data['experiencia'] ?? null,
            $data['mensaje'] ?? null,
        ]);

        jsonResponse(['message' => '¡Gracias por ofrecer tu tiempo! Revisaremos tu solicitud y te contactaremos.'], 201);
    }

    jsonResponse(['error' => 'Acción no válida'], 400);
} catch (PDOException $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
