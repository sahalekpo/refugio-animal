<?php

function obtenerMailFrom(): string
{
    $from = 'noreply@refugio-animales.local';
    $local = __DIR__ . '/db.local.php';
    if (file_exists($local)) {
        $cfg = require $local;
        $from = $cfg['mail_from'] ?? $from;
    }
    return $from;
}

function enviarCorreoNotificacion(string $correo, string $asunto, string $cuerpo): array
{
    $correo = trim($correo);
    if ($correo === '' || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        return ['sent' => false, 'message' => 'Sin correo válido'];
    }

    $from = obtenerMailFrom();
    $headers = "From: {$from}\r\nReply-To: {$from}\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    $ok = @mail($correo, $asunto, $cuerpo, $headers);

    return $ok
        ? ['sent' => true, 'message' => "Correo enviado a {$correo}"]
        : ['sent' => false, 'message' => 'No se pudo enviar el correo (configure mail en el servidor).', 'correo_destino' => $correo];
}

function notificarPostulacionRechazada(array $post, string $animalNombre, string $motivo = 'manual'): array
{
    $nombre = trim(($post['nombres'] ?? '') . ' ' . ($post['apellidos'] ?? ''));
    $portal = rtrim(baseUrl(), '/') . '/usuario.html#mi-solicitud';

    if ($motivo === 'otra_aprobada') {
        $asunto = 'Actualización de su postulación de adopción';
        $cuerpo = "Hola {$nombre},\n\n";
        $cuerpo .= "Le informamos que su postulación para adoptar a {$animalNombre} no fue seleccionada, ";
        $cuerpo .= "ya que otra solicitud fue aprobada y el animal ya no está disponible.\n\n";
        $cuerpo .= "Le invitamos a conocer otros animales en nuestro catálogo:\n{$portal}\n\n";
        $cuerpo .= "Refugio de Animales\n";
    } else {
        $asunto = 'Resultado de su postulación de adopción';
        $cuerpo = "Hola {$nombre},\n\n";
        $cuerpo .= "Su postulación para adoptar a {$animalNombre} no fue aprobada en esta ocasión.\n\n";
        $cuerpo .= "Puede consultar el estado en el portal con su cédula:\n{$portal}\n\n";
        $cuerpo .= "Refugio de Animales\n";
    }

    return enviarCorreoNotificacion($post['correo'] ?? '', $asunto, $cuerpo);
}

function notificarApoyoAceptado(string $tipo, array $row, ?string $animalNombre = null): array
{
    $nombre = trim($row['nombres'] ?? '');
    if (!empty($row['apellidos'])) {
        $nombre = trim($nombre . ' ' . $row['apellidos']);
    }

    if ($tipo === 'Voluntariado') {
        $asunto = '¡Su solicitud de voluntariado fue aceptada!';
        $cuerpo = "Hola {$nombre},\n\n";
        $cuerpo .= "Nos complace informarle que su solicitud de voluntariado fue ACEPTADA.\n";
        $cuerpo .= "Áreas de interés: {$row['areas_interes']}\n";
        $cuerpo .= "Disponibilidad: {$row['disponibilidad']}\n\n";
        $cuerpo .= "Pronto nos pondremos en contacto para coordinar los siguientes pasos.\n\n";
    } elseif ($tipo === 'Apadrinamiento') {
        $asunto = '¡Su apadrinamiento fue aceptado!';
        $cuerpo = "Hola {$nombre},\n\n";
        $cuerpo .= "Su solicitud de apadrinamiento";
        if ($animalNombre) {
            $cuerpo .= " para {$animalNombre}";
        }
        $cuerpo .= " fue ACEPTADA.\n\nPronto le contactaremos con los detalles.\n\n";
    } else {
        $asunto = '¡Su donación fue aceptada!';
        $cuerpo = "Hola {$nombre},\n\n";
        $cuerpo .= "Su solicitud de donación fue ACEPTADA.\n\n";
        $cuerpo .= "Gracias por apoyar al refugio. Pronto le contactaremos.\n\n";
    }

    $cuerpo .= "Refugio de Animales\n";
    return enviarCorreoNotificacion($row['correo'] ?? '', $asunto, $cuerpo);
}

function notificarApoyoRechazado(string $tipo, array $row, ?string $animalNombre = null): array
{
    $nombre = trim($row['nombres'] ?? '');
    if (!empty($row['apellidos'])) {
        $nombre = trim($nombre . ' ' . $row['apellidos']);
    }

    $asunto = 'Actualización de su solicitud — Refugio de Animales';
    $cuerpo = "Hola {$nombre},\n\n";
    $cuerpo .= "Le informamos que su solicitud de {$tipo}";
    if ($tipo === 'Apadrinamiento' && $animalNombre) {
        $cuerpo .= " para {$animalNombre}";
    }
    $cuerpo .= " no fue aprobada en esta ocasión.\n\n";
    $cuerpo .= "Agradecemos su interés en apoyar al refugio.\n\nRefugio de Animales\n";

    return enviarCorreoNotificacion($row['correo'] ?? '', $asunto, $cuerpo);
}

function baseUrl(): string
{
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8080';
    return "{$scheme}://{$host}";
}
