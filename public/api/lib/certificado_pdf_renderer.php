<?php
/**
 * Renderiza el certificado con el mismo diseño que certificado.html (sin dependencias externas).
 */
class CertificadoPdfRenderer
{
    private const PW = 612.0;
    private const PH = 792.0;
    private const MX = 36.0;
    private const MY = 36.0;
    private const CW = 540.0;

    private const PRIMARY = [0.102, 0.235, 0.204];
    private const ACCENT = [0.176, 0.624, 0.498];
    private const GREY = [0.420, 0.486, 0.463];
    private const TEXT = [0.102, 0.180, 0.157];
    private const BOX_BG = [0.973, 0.980, 0.976];

    private array $ops = [];

    public static function renderToFile(array $d, string $path): bool
    {
        $pdf = (new self())->build($d);
        return file_put_contents($path, $pdf) !== false;
    }

    public function build(array $d): string
    {
        $this->ops = [];

        $fecha = self::fmt($d['fecha_adopcion'] ?? '');
        $proxima = self::fmt($d['proxima_visita'] ?? '');
        $adoptante = self::enc($d['adoptante'] ?? '');
        $cedula = self::enc($d['cedula'] ?? '');
        $animal = self::enc($d['animal'] ?? '');
        $especie = self::enc($d['nombre_especie'] ?? '');
        $raza = !empty($d['raza']) ? ', raza ' . self::enc($d['raza']) : '';
        $codigo = self::enc($d['certificado_codigo'] ?? '');
        $freq = self::enc($d['frecuencia_visitas'] ?? 'Segun calendario del refugio');
        $empleado = self::enc($d['empleado'] ?? '');

        $x0 = self::MX;
        $y0 = self::MY;
        $w = self::CW;
        $h = self::PH - 2 * self::MY;

        $this->strokeRect($x0, $y0, $w, $h, self::PRIMARY, 3);

        $pad = 42.0;
        $cx = $x0 + $pad;
        $innerW = $w - 2 * $pad;
        $y = $y0 + $h - $pad;

        $y = $this->centeredText('CERTIFICADO DE ADOPCION RESPONSABLE', $cx, $innerW, $y, 20, true, self::PRIMARY);
        $y -= 6;
        $y = $this->centeredText('Refugio de Animales — Documento oficial de traslado de custodia', $cx, $innerW, $y, 10, false, self::GREY);
        $y -= 4;
        $y = $this->centeredText($codigo, $cx, $innerW, $y, 13, true, self::ACCENT);
        $y -= 14;

        $lineY = $y;
        $this->hline($cx, $lineY, $innerW, self::PRIMARY, 2);
        $y = $lineY - 22;

        $paragraph = [
            ['t' => 'Por medio del presente documento se certifica que el dia ', 'b' => false],
            ['t' => $fecha, 'b' => true],
            ['t' => ', el adoptante ', 'b' => false],
            ['t' => $adoptante, 'b' => true],
            ['t' => ', identificado(a) con cedula ', 'b' => false],
            ['t' => $cedula, 'b' => true],
            ['t' => ', ha adoptado de forma responsable al animal ', 'b' => false],
            ['t' => $animal, 'b' => true],
            ['t' => " ({$especie}{$raza}), quedando bajo su cuidado permanente.", 'b' => false],
        ];
        $y = $this->wrapSegments($paragraph, $cx, $y, $innerW, 11, 16);
        $y -= 18;

        $grid = [
            ['ADOPTANTE', $adoptante],
            ['ANIMAL', $animal],
            ['FECHA ADOPCION', $fecha],
            ['VISITAS DE SEGUIMIENTO', $freq],
            ['PROXIMA VISITA', $proxima],
            ['RESPONSABLE REFUGIO', $empleado],
        ];
        $y = $this->drawGrid($grid, $cx, $y, $innerW);
        $y -= 16;

        $y = $this->wrapText(
            'El adoptante se compromete a garantizar el bienestar, alimentacion, salud, proteccion y trato digno del animal, conforme a la normativa vigente de proteccion animal.',
            $cx, $y, $innerW, 11, false, self::TEXT, 16
        );
        $y -= 20;

        $this->hline($cx, $y, $innerW, [0.886, 0.910, 0.902], 1);
        $y -= 18;
        $y = $this->centeredText('Marco legal vigente que avala esta adopcion', $cx, $innerW, $y, 12, true, self::PRIMARY);
        $y -= 14;

        $laws = [
            ['Ley 84 de 1989', ' — Estatuto Nacional de Proteccion de los Animales. Establece deberes de proteccion, prohibicion de maltrato y responsabilidad del tenedor sobre el bienestar del animal.'],
            ['Ley 1774 de 2016', ' — Reconoce a los animales como seres sintientes y modifica el Codigo Civil para exigir proteccion conforme a su especie y trato sin crueldad.'],
            ['Decreto 1073 de 2015', ' — Reglamenta aspectos de bienestar animal y las obligaciones de quienes tienen animales bajo su cuidado.'],
            ['Ley 1801 de 2016 (Codigo de Convivencia)', ' — Contempla deberes de tenencia responsable de mascotas y sanciones por abandono o maltrato.'],
        ];
        foreach ($laws as [$law, $desc]) {
            $y = $this->bulletLaw($law, $desc, $cx, $y, $innerW);
            $y -= 6;
        }

        $y -= 10;
        $sigY = max($y0 + 70, $y - 30);
        $colW = ($innerW - 24) / 2;
        $this->sigBlock($cx, $sigY, $colW, 'Firma adoptante');
        $this->sigBlock($cx + $colW + 24, $sigY, $colW, 'Firma representante refugio');

        return $this->assemblePdf();
    }

    private function drawGrid(array $items, float $x, float $y, float $w): float
    {
        $gap = 12.0;
        $colW = ($w - $gap) / 2;
        $boxH = 54.0;
        $row = 0;
        $col = 0;
        $startY = $y;

        foreach ($items as [$label, $value]) {
            $bx = $x + $col * ($colW + $gap);
            $by = $startY - $row * ($boxH + $gap) - $boxH;
            $this->fillRect($bx, $by, $colW, $boxH, self::BOX_BG);
            $this->strokeRect($bx, $by, $colW, $boxH, [0.92, 0.94, 0.93], 0.5);
            $this->textAt($label, $bx + 12, $by + $boxH - 14, 7.5, true, self::GREY);
            $this->textAt($value, $bx + 12, $by + 16, 11, false, self::TEXT);

            $col++;
            if ($col >= 2) {
                $col = 0;
                $row++;
            }
        }

        return $startY - 3 * ($boxH + $gap);
    }

    private function sigBlock(float $x, float $y, float $w, string $label): void
    {
        $this->hline($x, $y + 14, $w, self::TEXT, 0.8);
        $this->centeredText($label, $x, $w, $y, 9, false, self::GREY);
    }

    private function bulletLaw(string $law, string $desc, float $x, float $y, float $w): float
    {
        $bulletX = $x + 4;
        $textX = $x + 16;
        $textW = $w - 16;
        $this->textAt('-', $bulletX, $y, 11, false, self::TEXT);

        $segments = [
            ['t' => $law, 'b' => true],
            ['t' => self::enc($desc), 'b' => false],
        ];
        return $this->wrapSegments($segments, $textX, $y, $textW, 10, 14);
    }

    private function centeredText(string $text, float $x, float $w, float $y, float $size, bool $bold, array $color): float
    {
        $tw = $this->textWidth($text, $size, $bold);
        $tx = $x + max(0, ($w - $tw) / 2);
        $this->textAt($text, $tx, $y, $size, $bold, $color);
        return $y - $size - 4;
    }

    private function wrapText(string $text, float $x, float $y, float $w, float $size, bool $bold, array $color, float $leading): float
    {
        return $this->wrapSegments([['t' => $text, 'b' => $bold]], $x, $y, $w, $size, $leading, $color);
    }

    private function wrapSegments(array $segments, float $x, float $y, float $w, float $size, float $leading, ?array $color = null): float
    {
        $color = $color ?? self::TEXT;
        $words = [];
        foreach ($segments as $seg) {
            $parts = preg_split('/\s+/', trim($seg['t'])) ?: [];
            foreach ($parts as $i => $part) {
                if ($part === '') continue;
                $word = ($i > 0 ? ' ' : '') . $part;
                $words[] = ['t' => $word, 'b' => $seg['b']];
            }
        }

        $lines = [];
        $line = [];
        $lineW = 0.0;

        foreach ($words as $word) {
            $ww = $this->textWidth($word['t'], $size, $word['b']);
            if ($lineW + $ww > $w && $line !== []) {
                $lines[] = $line;
                $line = [];
                $lineW = 0.0;
                $word['t'] = ltrim($word['t']);
                $ww = $this->textWidth($word['t'], $size, $word['b']);
            }
            $line[] = $word;
            $lineW += $ww;
        }
        if ($line !== []) {
            $lines[] = $line;
        }

        $cy = $y;
        foreach ($lines as $lineWords) {
            $cx = $x;
            foreach ($lineWords as $word) {
                $this->textAt($word['t'], $cx, $cy, $size, $word['b'], $color);
                $cx += $this->textWidth($word['t'], $size, $word['b']);
            }
            $cy -= $leading;
        }

        return $cy + $leading - 4;
    }

    private function textWidth(string $text, float $size, bool $bold): float
    {
        $factor = $bold ? 0.52 : 0.48;
        return strlen($text) * $size * $factor;
    }

    private function textAt(string $text, float $x, float $y, float $size, bool $bold, array $color): void
    {
        $font = $bold ? 'F2' : 'F1';
        $this->ops[] = sprintf(
            "BT /%s %.1f Tf %.3f %.3f %.3f rg 1 0 0 1 %.2f %.2f Tm (%s) Tj ET",
            $font,
            $size,
            $color[0],
            $color[1],
            $color[2],
            $x,
            $y,
            $this->escape($text)
        );
    }

    private function fillRect(float $x, float $y, float $w, float $h, array $color): void
    {
        $this->ops[] = sprintf(
            "q %.3f %.3f %.3f rg %.2f %.2f %.2f %.2f re f Q",
            $color[0], $color[1], $color[2], $x, $y, $w, $h
        );
    }

    private function strokeRect(float $x, float $y, float $w, float $h, array $color, float $width): void
    {
        $this->ops[] = sprintf(
            "q %.1f w %.3f %.3f %.3f RG %.2f %.2f %.2f %.2f re S Q",
            $width, $color[0], $color[1], $color[2], $x, $y, $w, $h
        );
    }

    private function hline(float $x, float $y, float $w, array $color, float $width): void
    {
        $this->ops[] = sprintf(
            "q %.1f w %.3f %.3f %.3f RG %.2f %.2f m %.2f %.2f l S Q",
            $width, $color[0], $color[1], $color[2], $x, $y, $x + $w, $y
        );
    }

    private static function fmt(string $fecha): string
    {
        if ($fecha === '') return '—';
        $p = explode('-', $fecha);
        return count($p) === 3 ? "{$p[2]}/{$p[1]}/{$p[0]}" : $fecha;
    }

    private static function enc(string $s): string
    {
        $c = @iconv('UTF-8', 'ISO-8859-1//TRANSLIT//IGNORE', $s);
        return $c !== false ? $c : $s;
    }

    private function escape(string $s): string
    {
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $s);
    }

    private function assemblePdf(): string
    {
        $content = implode("\n", $this->ops);
        $len = strlen($content);

        $objs = [];
        $objs[] = "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n";
        $objs[] = "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n";
        $objs[] = "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>endobj\n";
        $objs[] = "4 0 obj<< /Length {$len} >>stream\n{$content}\nendstream\nendobj\n";
        $objs[] = "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n";
        $objs[] = "6 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>endobj\n";

        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objs as $obj) {
            $offsets[] = strlen($pdf);
            $pdf .= $obj;
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 " . count($offsets) . "\n0000000000 65535 f \n";
        for ($i = 1; $i < count($offsets); $i++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
        }
        $pdf .= "trailer<< /Size " . count($offsets) . " /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
        return $pdf;
    }
}
