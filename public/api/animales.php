<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;
$id     = $_GET['id'] ?? null;

try {
    $pdo = getConnection();

    if ($action === 'especies' && $method === 'GET') {
        $in = implode(',', array_fill(0, count(especiesPermitidas()), '?'));
        $stmt = $pdo->prepare("SELECT * FROM especies WHERE nombre_especie IN ($in) ORDER BY nombre_especie");
        $stmt->execute(especiesPermitidas());
        jsonResponse($stmt->fetchAll());
    }

    if ($action === 'estados' && $method === 'GET') {
        requireAuth();
        $stmt = $pdo->query('SELECT * FROM estados ORDER BY nombre_estado');
        jsonResponse($stmt->fetchAll());
    }

    if ($action === 'fotos' && $method === 'GET' && $id) {
        jsonResponse(fotosAnimal($pdo, $id));
    }

    if ($action === 'disponibles' && $method === 'GET') {
        $rows = $pdo->query('SELECT * FROM vw_animales_disponibles ORDER BY fecha_ingreso DESC')->fetchAll();
        foreach ($rows as &$r) {
            $r['fotos'] = fotosAnimal($pdo, $r['id_animal']);
            if (empty($r['fotos']) && !empty($r['foto'])) {
                $r['fotos'] = [['ruta' => $r['foto'], 'orden' => 0]];
            }
        }
        jsonResponse($rows);
    }

    if ($action === 'adoptados' && $method === 'GET') {
        requireAuth();
        $stmt = $pdo->query('SELECT * FROM vw_animales_adoptados ORDER BY fecha_adopcion DESC');
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'GET' && $id) {
        $public = isset($_GET['public']);
        if (!$public) requireAuth();

        $stmt = $pdo->prepare('
            SELECT a.*, e.nombre_especie, es.nombre_estado
            FROM animales a
            INNER JOIN especies e ON a.id_especie = e.id_especie
            INNER JOIN estados es ON a.id_estado = es.id_estado
            WHERE a.id_animal = ?
        ');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) jsonResponse(['error' => 'Animal no encontrado'], 404);
        $row['fotos'] = fotosAnimal($pdo, $id);
        jsonResponse($row);
    }

    if ($method === 'GET') {
        requireAuth();
        $stmt = $pdo->query('
            SELECT a.id_animal, a.nombre, e.nombre_especie, a.raza, a.sexo, a.edad,
                   a.fecha_ingreso, a.descripcion, a.foto, es.nombre_estado, a.id_especie, a.id_estado
            FROM animales a
            INNER JOIN especies e ON a.id_especie = e.id_especie
            INNER JOIN estados es ON a.id_estado = es.id_estado
            ORDER BY a.fecha_ingreso DESC
        ');
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST') {
        requireAuth();
        $data = getJsonBody();
        normalizeBody($data);
        requireFields($data, ['nombre', 'id_especie', 'sexo', 'fecha_ingreso']);
        assertEspeciePermitida($pdo, (int) $data['id_especie']);

        $idDisponible = getEstadoId($pdo, 'Disponible');
        $edad = isset($data['edad']) ? $data['edad'] : null;
        $perfil = perfilAnimalDesdeBody($data);

        $pdo->prepare('
            INSERT INTO animales (
                nombre, id_especie, raza, sexo, edad, fecha_ingreso, descripcion, id_estado, foto,
                vacunado, esterilizado, desparasitado, compatible_ninos, compatible_mascotas, nivel_energia
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ')->execute([
            $data['nombre'],
            $data['id_especie'],
            $data['raza'] ?? null,
            $data['sexo'],
            $edad,
            $data['fecha_ingreso'],
            $data['descripcion'] ?? null,
            $idDisponible,
            null,
            $perfil['vacunado'],
            $perfil['esterilizado'],
            $perfil['desparasitado'],
            $perfil['compatible_ninos'],
            $perfil['compatible_mascotas'],
            $perfil['nivel_energia'],
        ]);

        $idAnimal = (int) $pdo->lastInsertId();
        $fotos = $data['fotos'] ?? [];
        if (!empty($data['foto'])) {
            $fotos = array_merge([$data['foto']], $fotos);
        }
        guardarFotosAnimal($pdo, $idAnimal, $fotos);

        jsonResponse(['message' => 'Animal registrado correctamente', 'id_animal' => $idAnimal], 201);
    }

    if ($method === 'PUT' && $id) {
        requireAuth();
        $data = getJsonBody();
        normalizeBody($data);
        if (!empty($data['id_especie'])) {
            assertEspeciePermitida($pdo, (int) $data['id_especie']);
        }

        $edad = isset($data['edad']) ? $data['edad'] : null;
        $perfil = perfilAnimalDesdeBody($data);

        $stmt = $pdo->prepare('
            UPDATE animales SET
                nombre = ?, id_especie = ?, raza = ?, sexo = ?, edad = ?,
                fecha_ingreso = ?, descripcion = ?, id_estado = ?,
                vacunado = ?, esterilizado = ?, desparasitado = ?,
                compatible_ninos = ?, compatible_mascotas = ?, nivel_energia = ?
            WHERE id_animal = ?
        ');
        $stmt->execute([
            $data['nombre'], $data['id_especie'], $data['raza'] ?? null, $data['sexo'],
            $edad, $data['fecha_ingreso'], $data['descripcion'] ?? null,
            $data['id_estado'],
            $perfil['vacunado'], $perfil['esterilizado'], $perfil['desparasitado'],
            $perfil['compatible_ninos'], $perfil['compatible_mascotas'], $perfil['nivel_energia'],
            $id
        ]);

        if (!empty($data['fotos']) && is_array($data['fotos'])) {
            $pdo->prepare('DELETE FROM animal_fotos WHERE id_animal = ?')->execute([$id]);
            guardarFotosAnimal($pdo, $id, $data['fotos']);
        } elseif (!empty($data['foto'])) {
            $pdo->prepare('UPDATE animales SET foto = ? WHERE id_animal = ?')->execute([$data['foto'], $id]);
        }

        jsonResponse(['message' => 'Animal actualizado correctamente']);
    }

    if ($method === 'DELETE' && $id) {
        requireAuth();
        $pdo->prepare('DELETE FROM animal_fotos WHERE id_animal = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM vacunas WHERE id_animal = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM visitas_seguimiento WHERE id_adopcion IN (SELECT id_adopcion FROM adopciones WHERE id_animal = ?)')->execute([$id]);
        $pdo->prepare('DELETE FROM adopciones WHERE id_animal = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM postulaciones WHERE id_animal = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM historial_medico WHERE id_animal = ?')->execute([$id]);
        $stmt = $pdo->prepare('DELETE FROM animales WHERE id_animal = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) jsonResponse(['error' => 'Animal no encontrado'], 404);
        jsonResponse(['message' => 'Animal eliminado correctamente']);
    }

    jsonResponse(['error' => 'Método no permitido'], 405);
} catch (PDOException $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
