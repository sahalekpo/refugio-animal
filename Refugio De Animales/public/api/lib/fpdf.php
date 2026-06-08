<?php
/**
 * Generador PDF mínimo — posicionamiento absoluto por línea (Tm).
 */
class FPDF
{
    private array $lines = [];
    private float $y = 750;
    private int $fontSize = 12;
    private bool $bold = false;
    private float $marginLeft = 50;
    private float $pageWidth = 612;

    public function AddPage(): void
    {
        $this->lines = [];
        $this->y = 750;
    }

    public function SetFont(string $family, string $style = '', int $size = 12): void
    {
        $this->fontSize = $size;
        $this->bold = str_contains($style, 'B');
    }

    public function Ln(float $h = 5): void
    {
        $this->y -= $h * 4;
    }

    public function Cell(float $w, float $h, string $txt, int $border = 0, int $ln = 0, string $align = ''): void
    {
        $this->addLine($txt, $align === 'C');
        if ($ln) {
            $this->y -= max($h * 2, $this->fontSize + 8);
        }
    }

    public function MultiCell(float $w, float $h, string $txt): void
    {
        $txt = $this->enc($txt);
        $maxChars = 78;
        $words = preg_split('/\s+/', $txt) ?: [];
        $line = '';

        foreach ($words as $word) {
            $candidate = $line === '' ? $word : $line . ' ' . $word;
            if (strlen($candidate) > $maxChars && $line !== '') {
                $this->addLine($line, false);
                $line = $word;
            } else {
                $line = $candidate;
            }
        }
        if ($line !== '') {
            $this->addLine($line, false);
        }
        $this->y -= $h;
    }

    private function addLine(string $txt, bool $center = false): void
    {
        $encoded = $this->enc($txt);
        $x = $this->marginLeft;
        if ($center) {
            $approxWidth = strlen($encoded) * $this->fontSize * 0.45;
            $x = max($this->marginLeft, ($this->pageWidth - $approxWidth) / 2);
        }

        $this->lines[] = [
            'x' => $x,
            'y' => $this->y,
            'size' => $this->fontSize,
            'bold' => $this->bold,
            'text' => $encoded,
        ];
        $this->y -= $this->fontSize + 10;
    }

    private function enc(string $s): string
    {
        $c = @iconv('UTF-8', 'ISO-8859-1//TRANSLIT//IGNORE', $s);
        return $c !== false ? $c : $s;
    }

    public function Output(string $dest, string $name = ''): void
    {
        $pdf = $this->buildPdf();
        if ($dest === 'F') {
            file_put_contents($name, $pdf);
            return;
        }
        echo $pdf;
    }

    private function buildPdf(): string
    {
        $content = "BT\n";
        foreach ($this->lines as $l) {
            $font = $l['bold'] ? 'F2' : 'F1';
            $content .= sprintf(
                "/%s %d Tf 1 0 0 1 %.2f %.2f Tm (%s) Tj\n",
                $font,
                $l['size'],
                $l['x'],
                $l['y'],
                $this->escape($l['text'])
            );
        }
        $content .= "ET";

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

    private function escape(string $s): string
    {
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $s);
    }
}
