<?php

function obtenerDatosCertificado(PDO $pdo, string $codigo): ?array
{
    $stmt = $pdo->prepare("
        SELECT ad.id_adopcion, ad.fecha_adopcion, ad.frecuencia_visitas, ad.proxima_visita,
               ad.certificado_codigo,
               an.nombre AS animal, e.nombre_especie, an.raza,
               CONCAT(ap.nombres,' ',ap.apellidos) AS adoptante,
               ap.nombres, ap.apellidos, ap.cedula, ap.correo, ap.telefono, ap.direccion,
               CONCAT(em.nombres,' ',em.apellidos) AS empleado
        FROM adopciones ad
        INNER JOIN animales an ON ad.id_animal = an.id_animal
        INNER JOIN especies e ON an.id_especie = e.id_especie
        INNER JOIN adoptantes ap ON ad.id_adoptante = ap.id_adoptante
        INNER JOIN empleados em ON ad.id_empleado = em.id_empleado
        WHERE ad.certificado_codigo = ?
    ");
    $stmt->execute([$codigo]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function formatearFechaCert(string $fecha): string
{
    if (!$fecha) return '—';
    $p = explode('-', $fecha);
    return count($p) === 3 ? "{$p[2]}/{$p[1]}/{$p[0]}" : $fecha;
}

function htmlCertificado(array $d): string
{
    $codigo = htmlspecialchars($d['certificado_codigo']);
    $adoptante = htmlspecialchars($d['adoptante']);
    $cedula = htmlspecialchars($d['cedula']);
    $animal = htmlspecialchars($d['animal']);
    $especie = htmlspecialchars($d['nombre_especie']);
    $raza = !empty($d['raza']) ? ', raza ' . htmlspecialchars($d['raza']) : '';
    $fecha = formatearFechaCert($d['fecha_adopcion']);
    $proxima = formatearFechaCert($d['proxima_visita'] ?? '');
    $empleado = htmlspecialchars($d['empleado']);
    $freq = htmlspecialchars($d['frecuencia_visitas'] ?? 'Según calendario del refugio');

    return <<<HTML
<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Certificado {$codigo}</title>
<style>
:root { --primary:#1a3c34; --accent:#2d9f7f; }
body { font-family:Arial,Helvetica,sans-serif; background:#fff; color:#1a2e28; padding:2rem; margin:0; }
.cert { max-width:800px; margin:0 auto; background:#fff; border:3px solid var(--primary); border-radius:4px; padding:3rem; }
.cert-header { text-align:center; border-bottom:2px solid var(--primary); padding-bottom:1.5rem; margin-bottom:2rem; }
.cert-header h1 { font-size:1.8rem; color:var(--primary); margin:0; }
.cert-header p { color:#6b7c76; margin-top:.5rem; }
.codigo { text-align:center; font-weight:800; color:var(--accent); margin-top:.75rem; }
.cert-body p { line-height:1.8; margin-bottom:1rem; }
.cert-data { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin:1.5rem 0; }
.cert-data div { background:#f8faf9; padding:1rem; border-radius:10px; }
.cert-data strong { display:block; font-size:.75rem; text-transform:uppercase; color:#6b7c76; margin-bottom:4px; }
.laws { margin-top:2rem; padding-top:1.5rem; border-top:1px solid #e2e8e6; }
.laws h2 { font-size:1.1rem; margin-bottom:1rem; color:var(--primary); text-align:center; }
.laws ul { padding-left:1.25rem; color:#444; line-height:1.8; font-size:.92rem; }
.laws li { margin-bottom:.75rem; }
.firma { margin-top:2.5rem; display:flex; justify-content:space-between; gap:2rem; }
.firma div { flex:1; text-align:center; border-top:1px solid #333; padding-top:.5rem; font-size:.85rem; color:#6b7c76; }
</style></head><body>
<div class="cert">
  <div class="cert-header">
    <h1>CERTIFICADO DE ADOPCIÓN RESPONSABLE</h1>
    <p>Refugio de Animales — Documento oficial de traslado de custodia</p>
    <p class="codigo">{$codigo}</p>
  </div>
  <div class="cert-body">
    <p>Por medio del presente documento se certifica que el día <strong>{$fecha}</strong>,
    el adoptante <strong>{$adoptante}</strong>, identificado(a) con cédula <strong>{$cedula}</strong>,
    ha adoptado de forma responsable al animal <strong>{$animal}</strong> ({$especie}{$raza}),
    quedando bajo su cuidado permanente.</p>
    <div class="cert-data">
      <div><strong>Adoptante</strong>{$adoptante}</div>
      <div><strong>Animal</strong>{$animal}</div>
      <div><strong>Fecha adopción</strong>{$fecha}</div>
      <div><strong>Visitas de seguimiento</strong>{$freq}</div>
      <div><strong>Próxima visita</strong>{$proxima}</div>
      <div><strong>Responsable refugio</strong>{$empleado}</div>
    </div>
    <p>El adoptante se compromete a garantizar el bienestar, alimentación, salud, protección y trato digno del animal,
    conforme a la normativa vigente de protección animal.</p>
  </div>
  <div class="laws">
    <h2>Marco legal vigente que avala esta adopción</h2>
    <ul>
      <li><strong>Ley 84 de 1989</strong> — Estatuto Nacional de Protección de los Animales. Establece deberes de protección, prohibición de maltrato y responsabilidad del tenedor sobre el bienestar del animal.</li>
      <li><strong>Ley 1774 de 2016</strong> — Reconoce a los animales como seres sintientes y modifica el Código Civil para exigir protección conforme a su especie y trato sin crueldad.</li>
      <li><strong>Decreto 1073 de 2015</strong> — Reglamenta aspectos de bienestar animal y las obligaciones de quienes tienen animales bajo su cuidado.</li>
      <li><strong>Ley 1801 de 2016 (Código de Convivencia)</strong> — Contempla deberes de tenencia responsable de mascotas y sanciones por abandono o maltrato.</li>
    </ul>
  </div>
  <div class="firma">
    <div>Firma adoptante</div>
    <div>Firma representante refugio</div>
  </div>
</div>
</body></html>
HTML;
}

function directorioCertificados(): string
{
    $dir = dirname(__DIR__) . '/certificados';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    return $dir;
}

function guardarHtmlCertificado(array $d): string
{
    $dir = directorioCertificados();
    $file = $dir . '/' . preg_replace('/[^A-Za-z0-9\-]/', '', $d['certificado_codigo']) . '.html';
    file_put_contents($file, htmlCertificado($d));
    return $file;
}

function nombreArchivoCertificado(array $d, bool $paraDescarga = true): string
{
    $animal = trim($d['animal'] ?? 'adopcion');
    $slug = preg_replace('/[^A-Za-z0-9_\-\sáéíóúÁÉÍÓÚñÑ]/u', '', $animal);
    $slug = trim(preg_replace('/\s+/', ' ', $slug));
    if ($slug === '') {
        $slug = 'adopcion';
    }

    if ($paraDescarga) {
        return 'certificado ' . $slug . '.pdf';
    }

    $codigo = preg_replace('/[^A-Za-z0-9\-]/', '', $d['certificado_codigo'] ?? '');
    $fileSlug = preg_replace('/[^A-Za-z0-9_\-]/', '_', $slug);
    return $fileSlug . '_' . $codigo . '.pdf';
}

function generarPdfCertificado(array $d): ?string
{
    $dir = directorioCertificados();
    $filename = nombreArchivoCertificado($d, false);
    $path = $dir . '/' . $filename;

    require_once __DIR__ . '/lib/certificado_pdf_renderer.php';

    try {
        if (!CertificadoPdfRenderer::renderToFile($d, $path)) {
            return null;
        }
        return $path;
    } catch (Throwable $e) {
        error_log('PDF certificado: ' . $e->getMessage());
        return null;
    }
}

function enviarCorreoCertificado(array $d, ?string $pdfPath, string $baseUrl): array
{
    $correo = trim($d['correo'] ?? '');
    if ($correo === '' || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        return ['sent' => false, 'message' => 'El adoptante no tiene correo válido registrado.'];
    }

    $local = __DIR__ . '/db.local.php';
    $from = 'noreply@refugio-animales.local';
    if (file_exists($local)) {
        $cfg = require $local;
        $from = $cfg['mail_from'] ?? $from;
    }

    $codigo = $d['certificado_codigo'];
    $linkPortal = rtrim($baseUrl, '/') . '/usuario.html#mi-solicitud';
    $linkHtml = rtrim($baseUrl, '/') . '/certificado.html?codigo=' . urlencode($codigo);
    $linkPdf = rtrim($baseUrl, '/') . '/api/certificado_pdf.php?codigo=' . urlencode($codigo);

    $nombre = $d['nombres'] ?? $d['adoptante'];
    $asunto = '¡Felicitaciones! Su adopción fue aprobada — ' . $codigo;
    $cuerpo = "Hola {$nombre},\n\n";
    $cuerpo .= "Su postulación para adoptar a {$d['animal']} ha sido APROBADA.\n\n";
    $cuerpo .= "Consulte y descargue su certificado en el portal del refugio:\n{$linkPortal}\n";
    $cuerpo .= "(Ingrese su cédula: {$d['cedula']})\n\n";
    $cuerpo .= "También puede abrirlo directamente:\n{$linkHtml}\n";
    $cuerpo .= "Descargar PDF: {$linkPdf}\n\n";
    $cuerpo .= "Próxima visita de seguimiento: " . formatearFechaCert($d['proxima_visita'] ?? '') . "\n\n";
    $cuerpo .= "Refugio de Animales\n";

    $headers = "From: {$from}\r\nReply-To: {$from}\r\nContent-Type: text/plain; charset=UTF-8\r\n";

    $ok = false;
    if ($pdfPath && is_readable($pdfPath)) {
        $boundary = md5((string) time());
        $headers = "From: {$from}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n";
        $body = "--{$boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{$cuerpo}\r\n";
        $body .= "--{$boundary}\r\nContent-Type: application/pdf; name=\"certificado.pdf\"\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"" . nombreArchivoCertificado($d, true) . "\"\r\n\r\n";
        $body .= chunk_split(base64_encode(file_get_contents($pdfPath))) . "\r\n";
        $body .= "--{$boundary}--";
        $ok = @mail($correo, $asunto, $body, $headers);
    } else {
        $ok = @mail($correo, $asunto, $cuerpo, $headers);
    }

    if ($ok) {
        return ['sent' => true, 'message' => "Correo enviado a {$correo}"];
    }
    return [
        'sent' => false,
        'message' => 'No se pudo enviar el correo (configure mail en el servidor o use los enlaces del certificado).',
        'correo_destino' => $correo,
        'enlaces' => ['portal' => $linkPortal, 'html' => $linkHtml, 'pdf' => $linkPdf]
    ];
}

function baseUrlDesdeRequest(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8080';
    return ($https ? 'https' : 'http') . '://' . $host;
}

function emitirCertificadoCompleto(PDO $pdo, string $codigo): array
{
    $d = obtenerDatosCertificado($pdo, $codigo);
    if (!$d) {
        return ['ok' => false, 'error' => 'Certificado no encontrado'];
    }

    guardarHtmlCertificado($d);
    $pdfPath = generarPdfCertificado($d);
    $baseUrl = baseUrlDesdeRequest();
    $email = enviarCorreoCertificado($d, $pdfPath, $baseUrl);

    $relPdf = $pdfPath ? 'certificados/' . basename($pdfPath) : null;

    return [
        'ok' => true,
        'certificado_codigo' => $codigo,
        'certificado_url' => 'certificado.html?codigo=' . urlencode($codigo),
        'certificado_pdf' => $relPdf ? $relPdf : null,
        'pdf_api' => 'api/certificado_pdf.php?codigo=' . urlencode($codigo),
        'email' => $email
    ];
}
