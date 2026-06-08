<?php
/**
 * Ejecuta database_updates.sql y crea/actualiza usuario admin.
 * Usuario: admin | Contraseña: Admin2025!
 */
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = getConnection();
    $base = dirname(__DIR__, 2);
    $sql = file_get_contents($base . '/database_updates.sql');
    $sqlV3 = @file_get_contents($base . '/database_v3.sql');
    $sql = preg_replace('/^USE refugio_animales;\s*/m', '', $sql);

    $parts = preg_split('/;\s*\n/', $sql);
    foreach ($parts as $part) {
        $part = trim($part);
        if ($part === '' || str_starts_with($part, '--')) continue;
        if (str_contains($part, 'DELIMITER')) continue;
        try {
            $pdo->exec($part);
        } catch (PDOException $e) {
            if (!str_contains($e->getMessage(), 'Duplicate') &&
                !str_contains($e->getMessage(), 'already exists')) {
                echo "AVISO: " . $e->getMessage() . "\n";
            }
        }
    }

    // Trigger con DELIMITER manual
    $pdo->exec('DROP TRIGGER IF EXISTS tr_estado_proceso_adopcion');
    $pdo->exec("
        CREATE TRIGGER tr_estado_proceso_adopcion
        AFTER INSERT ON postulaciones
        FOR EACH ROW
        BEGIN
            UPDATE animales
            SET id_estado = (SELECT id_estado FROM estados WHERE nombre_estado = 'En proceso de adopción' LIMIT 1)
            WHERE id_animal = NEW.id_animal
              AND id_estado = (SELECT id_estado FROM estados WHERE nombre_estado = 'Disponible' LIMIT 1);
        END
    ");

    $hash = password_hash('Admin2025!', PASSWORD_DEFAULT);
    $exists = $pdo->query("SELECT id_usuario FROM usuarios WHERE usuario = 'admin'")->fetch();
    if ($exists) {
        $pdo->prepare('UPDATE usuarios SET contrasena = ?, rol = ? WHERE usuario = ?')
            ->execute([$hash, 'Administrador', 'admin']);
        echo "Usuario admin actualizado.\n";
    } else {
        $pdo->prepare('INSERT INTO usuarios (usuario, contrasena, rol) VALUES (?,?,?)')
            ->execute(['admin', $hash, 'Administrador']);
        echo "Usuario admin creado.\n";
    }

    if ($sqlV3) {
        $sqlV3 = preg_replace('/^USE refugio_animales;\s*/m', '', $sqlV3);
        foreach (preg_split('/;\s*\n/', $sqlV3) as $part) {
            $part = trim($part);
            if ($part === '' || str_starts_with($part, '--')) continue;
            try { $pdo->exec($part); } catch (PDOException $e) {
                if (!str_contains($e->getMessage(), 'Duplicate') && !str_contains($e->getMessage(), 'already exists')) {
                    echo "AVISO v3: " . $e->getMessage() . "\n";
                }
            }
        }
        echo "Migración v3 (fotos, vacunas, refugio) aplicada.\n";
    }

    $sqlEsp = @file_get_contents($base . '/database_especies_perro_gato.sql');
    if ($sqlEsp) {
        $sqlEsp = preg_replace('/^USE refugio_animales;\s*/m', '', $sqlEsp);
        foreach (preg_split('/;\s*\n/', $sqlEsp) as $part) {
            $part = trim($part);
            if ($part === '' || str_starts_with($part, '--')) continue;
            try {
                $pdo->exec($part);
            } catch (PDOException $e) {
                echo "AVISO especies: " . $e->getMessage() . "\n";
            }
        }
        echo "Migración especies (solo perros y gatos) aplicada.\n";
    }

    $sqlV4 = @file_get_contents($base . '/database_v4_features.sql');
    if ($sqlV4) {
        $sqlV4 = preg_replace('/^USE refugio_animales;\s*/m', '', $sqlV4);
        foreach (preg_split('/;\s*\n/', $sqlV4) as $part) {
            $part = trim($part);
            if ($part === '' || str_starts_with($part, '--')) continue;
            if (str_contains($part, 'PREPARE') || str_contains($part, 'SET @')) {
                try { $pdo->exec($part); } catch (PDOException $e) {
                    echo "AVISO v4: " . $e->getMessage() . "\n";
                }
                continue;
            }
            try { $pdo->exec($part); } catch (PDOException $e) {
                if (!str_contains($e->getMessage(), 'Duplicate') && !str_contains($e->getMessage(), 'already exists')) {
                    echo "AVISO v4: " . $e->getMessage() . "\n";
                }
            }
        }
        echo "Migración v4 (perfil, donaciones, voluntariado) aplicada.\n";
    }

    echo "Migración completada.\n";
    echo "Login admin: usuario=admin | contraseña=Admin2025!\n";
} catch (Exception $e) {
    http_response_code(500);
    echo "ERROR: " . $e->getMessage();
}
