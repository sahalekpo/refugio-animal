const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const CERT_DIR = path.join(__dirname, '..', 'public', 'certificados');

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatearFecha(fecha) {
  if (!fecha) return '—';
  const p = String(fecha).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : fecha;
}

async function obtenerDatosCertificado(codigo) {
  const [rows] = await pool.query(`
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
    WHERE ad.certificado_codigo = ?`, [codigo]);
  return rows[0] || null;
}

function htmlCertificado(d) {
  const codigo = escHtml(d.certificado_codigo);
  const adoptante = escHtml(d.adoptante);
  const cedula = escHtml(d.cedula);
  const animal = escHtml(d.animal);
  const especie = escHtml(d.nombre_especie);
  const raza = d.raza ? `, raza ${escHtml(d.raza)}` : '';
  const fecha = formatearFecha(d.fecha_adopcion);
  const proxima = formatearFecha(d.proxima_visita);
  const empleado = escHtml(d.empleado);
  const freq = escHtml(d.frecuencia_visitas || 'Según calendario del refugio');

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Certificado ${codigo}</title>
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
    <p class="codigo">${codigo}</p>
  </div>
  <div class="cert-body">
    <p>Por medio del presente documento se certifica que el día <strong>${fecha}</strong>,
    el adoptante <strong>${adoptante}</strong>, identificado(a) con cédula <strong>${cedula}</strong>,
    ha adoptado de forma responsable al animal <strong>${animal}</strong> (${especie}${raza}),
    quedando bajo su cuidado permanente.</p>
    <div class="cert-data">
      <div><strong>Adoptante</strong>${adoptante}</div>
      <div><strong>Animal</strong>${animal}</div>
      <div><strong>Fecha adopción</strong>${fecha}</div>
      <div><strong>Visitas de seguimiento</strong>${freq}</div>
      <div><strong>Próxima visita</strong>${proxima}</div>
      <div><strong>Responsable refugio</strong>${empleado}</div>
    </div>
    <p>El adoptante se compromete a garantizar el bienestar, alimentación, salud, protección y trato digno del animal,
    conforme a la normativa vigente de protección animal.</p>
  </div>
  <div class="laws">
    <h2>Marco legal vigente que avala esta adopción</h2>
    <ul>
      <li><strong>Ley 84 de 1989</strong> — Estatuto Nacional de Protección de los Animales.</li>
      <li><strong>Ley 1774 de 2016</strong> — Reconoce a los animales como seres sintientes.</li>
      <li><strong>Decreto 1073 de 2015</strong> — Reglamenta aspectos de bienestar animal.</li>
      <li><strong>Ley 1801 de 2016</strong> — Deberes de tenencia responsable de mascotas.</li>
    </ul>
  </div>
  <div class="firma">
    <div>Firma adoptante</div>
    <div>Firma representante refugio</div>
  </div>
</div>
</body></html>`;
}

function nombreArchivoCertificado(d, paraDescarga = true) {
  let slug = String(d.animal || 'adopcion').replace(/[^A-Za-z0-9_\-\sáéíóúÁÉÍÓÚñÑ]/gu, '').trim();
  if (!slug) slug = 'adopcion';
  if (paraDescarga) return `certificado ${slug}.pdf`;
  const codigo = String(d.certificado_codigo || '').replace(/[^A-Za-z0-9\-]/g, '');
  const fileSlug = slug.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-]/g, '_');
  return `${fileSlug}_${codigo}.pdf`;
}

function ensureCertDir() {
  if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });
}

function guardarHtmlCertificado(d) {
  ensureCertDir();
  const file = path.join(CERT_DIR, `${String(d.certificado_codigo).replace(/[^A-Za-z0-9\-]/g, '')}.html`);
  fs.writeFileSync(file, htmlCertificado(d), 'utf8');
  return file;
}

class CertificadoPdfRenderer {
  static PW = 612;
  static PH = 792;
  static MX = 36;
  static MY = 36;
  static CW = 540;
  static PRIMARY = [0.102, 0.235, 0.204];
  static ACCENT = [0.176, 0.624, 0.498];
  static GREY = [0.420, 0.486, 0.463];
  static TEXT = [0.102, 0.180, 0.157];
  static BOX_BG = [0.973, 0.980, 0.976];

  constructor() {
    this.ops = [];
  }

  static enc(s) {
    return String(s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x00-\xFF]/g, '');
  }

  static fmt(fecha) {
    if (!fecha) return '—';
    const p = String(fecha).split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : fecha;
  }

  static renderToBuffer(d) {
    return new CertificadoPdfRenderer().build(d);
  }

  static renderToFile(d, filePath) {
    const pdf = CertificadoPdfRenderer.renderToBuffer(d);
    fs.writeFileSync(filePath, pdf);
    return filePath;
  }

  escape(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  textWidth(text, size, bold) {
    const factor = bold ? 0.52 : 0.48;
    return text.length * size * factor;
  }

  textAt(text, x, y, size, bold, color) {
    const font = bold ? 'F2' : 'F1';
    this.ops.push(
      `BT /${font} ${size.toFixed(1)} Tf ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${this.escape(text)}) Tj ET`
    );
  }

  fillRect(x, y, w, h, color) {
    this.ops.push(`q ${color.map((c) => c.toFixed(3)).join(' ')} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f Q`);
  }

  strokeRect(x, y, w, h, color, width) {
    this.ops.push(`q ${width.toFixed(1)} w ${color.map((c) => c.toFixed(3)).join(' ')} RG ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S Q`);
  }

  hline(x, y, w, color, width) {
    this.ops.push(`q ${width.toFixed(1)} w ${color.map((c) => c.toFixed(3)).join(' ')} RG ${x.toFixed(2)} ${y.toFixed(2)} m ${(x + w).toFixed(2)} ${y.toFixed(2)} l S Q`);
  }

  centeredText(text, x, w, y, size, bold, color) {
    const tw = this.textWidth(text, size, bold);
    const tx = x + Math.max(0, (w - tw) / 2);
    this.textAt(text, tx, y, size, bold, color);
    return y - size - 4;
  }

  wrapSegments(segments, x, y, w, size, leading, color = CertificadoPdfRenderer.TEXT) {
    const words = [];
    for (const seg of segments) {
      const parts = seg.t.trim().split(/\s+/).filter(Boolean);
      parts.forEach((part, i) => {
        words.push({ t: (i > 0 ? ' ' : '') + part, b: seg.b });
      });
    }
    const lines = [];
    let line = [];
    let lineW = 0;
    for (const word of words) {
      let wt = word.t;
      let ww = this.textWidth(wt, size, word.b);
      if (lineW + ww > w && line.length) {
        lines.push(line);
        line = [];
        lineW = 0;
        wt = wt.trimStart();
        ww = this.textWidth(wt, size, word.b);
      }
      line.push({ t: wt, b: word.b });
      lineW += ww;
    }
    if (line.length) lines.push(line);
    let cy = y;
    for (const lineWords of lines) {
      let cx = x;
      for (const word of lineWords) {
        this.textAt(word.t, cx, cy, size, word.b, color);
        cx += this.textWidth(word.t, size, word.b);
      }
      cy -= leading;
    }
    return cy + leading - 4;
  }

  drawGrid(items, x, y, w) {
    const gap = 12;
    const colW = (w - gap) / 2;
    const boxH = 54;
    let row = 0;
    let col = 0;
    const startY = y;
    for (const [label, value] of items) {
      const bx = x + col * (colW + gap);
      const by = startY - row * (boxH + gap) - boxH;
      this.fillRect(bx, by, colW, boxH, CertificadoPdfRenderer.BOX_BG);
      this.strokeRect(bx, by, colW, boxH, [0.92, 0.94, 0.93], 0.5);
      this.textAt(label, bx + 12, by + boxH - 14, 7.5, true, CertificadoPdfRenderer.GREY);
      this.textAt(value, bx + 12, by + 16, 11, false, CertificadoPdfRenderer.TEXT);
      col++;
      if (col >= 2) { col = 0; row++; }
    }
    return startY - 3 * (boxH + gap);
  }

  sigBlock(x, y, w, label) {
    this.hline(x, y + 14, w, CertificadoPdfRenderer.TEXT, 0.8);
    this.centeredText(label, x, w, y, 9, false, CertificadoPdfRenderer.GREY);
  }

  bulletLaw(law, desc, x, y, w) {
    this.textAt('-', x + 4, y, 11, false, CertificadoPdfRenderer.TEXT);
    return this.wrapSegments(
      [{ t: law, b: true }, { t: CertificadoPdfRenderer.enc(desc), b: false }],
      x + 16, y, w - 16, 10, 14
    );
  }

  assemblePdf() {
    const content = this.ops.join('\n');
    const len = Buffer.byteLength(content, 'utf8');
    const objs = [
      '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n',
      '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n',
      '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>endobj\n',
      `4 0 obj<< /Length ${len} >>stream\n${content}\nendstream\nendobj\n`,
      '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n',
      '6 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>endobj\n'
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const obj of objs) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += obj;
    }
    const xref = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, 'utf8');
  }

  build(d) {
    this.ops = [];
    const fecha = CertificadoPdfRenderer.fmt(d.fecha_adopcion);
    const proxima = CertificadoPdfRenderer.fmt(d.proxima_visita);
    const adoptante = CertificadoPdfRenderer.enc(d.adoptante);
    const cedula = CertificadoPdfRenderer.enc(d.cedula);
    const animal = CertificadoPdfRenderer.enc(d.animal);
    const especie = CertificadoPdfRenderer.enc(d.nombre_especie);
    const raza = d.raza ? `, raza ${CertificadoPdfRenderer.enc(d.raza)}` : '';
    const codigo = CertificadoPdfRenderer.enc(d.certificado_codigo);
    const freq = CertificadoPdfRenderer.enc(d.frecuencia_visitas || 'Segun calendario del refugio');
    const empleado = CertificadoPdfRenderer.enc(d.empleado);

    const x0 = CertificadoPdfRenderer.MX;
    const y0 = CertificadoPdfRenderer.MY;
    const w = CertificadoPdfRenderer.CW;
    const h = CertificadoPdfRenderer.PH - 2 * CertificadoPdfRenderer.MY;
    this.strokeRect(x0, y0, w, h, CertificadoPdfRenderer.PRIMARY, 3);

    const pad = 42;
    const cx = x0 + pad;
    const innerW = w - 2 * pad;
    let y = y0 + h - pad;

    y = this.centeredText('CERTIFICADO DE ADOPCION RESPONSABLE', cx, innerW, y, 20, true, CertificadoPdfRenderer.PRIMARY);
    y -= 6;
    y = this.centeredText('Refugio de Animales — Documento oficial de traslado de custodia', cx, innerW, y, 10, false, CertificadoPdfRenderer.GREY);
    y -= 4;
    y = this.centeredText(codigo, cx, innerW, y, 13, true, CertificadoPdfRenderer.ACCENT);
    y -= 14;
    this.hline(cx, y, innerW, CertificadoPdfRenderer.PRIMARY, 2);
    y -= 22;

    y = this.wrapSegments([
      { t: 'Por medio del presente documento se certifica que el dia ', b: false },
      { t: fecha, b: true },
      { t: ', el adoptante ', b: false },
      { t: adoptante, b: true },
      { t: ', identificado(a) con cedula ', b: false },
      { t: cedula, b: true },
      { t: ', ha adoptado de forma responsable al animal ', b: false },
      { t: animal, b: true },
      { t: ` (${especie}${raza}), quedando bajo su cuidado permanente.`, b: false }
    ], cx, y, innerW, 11, 16);
    y -= 18;

    y = this.drawGrid([
      ['ADOPTANTE', adoptante],
      ['ANIMAL', animal],
      ['FECHA ADOPCION', fecha],
      ['VISITAS DE SEGUIMIENTO', freq],
      ['PROXIMA VISITA', proxima],
      ['RESPONSABLE REFUGIO', empleado]
    ], cx, y, innerW);
    y -= 16;

    y = this.wrapSegments([{
      t: 'El adoptante se compromete a garantizar el bienestar, alimentacion, salud, proteccion y trato digno del animal, conforme a la normativa vigente de proteccion animal.',
      b: false
    }], cx, y, innerW, 11, 16);
    y -= 20;

    this.hline(cx, y, innerW, [0.886, 0.910, 0.902], 1);
    y -= 18;
    y = this.centeredText('Marco legal vigente que avala esta adopcion', cx, innerW, y, 12, true, CertificadoPdfRenderer.PRIMARY);
    y -= 14;

    const laws = [
      ['Ley 84 de 1989', ' — Estatuto Nacional de Proteccion de los Animales.'],
      ['Ley 1774 de 2016', ' — Reconoce a los animales como seres sintientes.'],
      ['Decreto 1073 de 2015', ' — Reglamenta aspectos de bienestar animal.'],
      ['Ley 1801 de 2016', ' — Deberes de tenencia responsable de mascotas.']
    ];
    for (const [law, desc] of laws) {
      y = this.bulletLaw(law, desc, cx, y, innerW);
      y -= 6;
    }

    const sigY = Math.max(y0 + 70, y - 30);
    const colW = (innerW - 24) / 2;
    this.sigBlock(cx, sigY, colW, 'Firma adoptante');
    this.sigBlock(cx + colW + 24, sigY, colW, 'Firma representante refugio');

    return this.assemblePdf();
  }
}

function generarPdfCertificado(d) {
  ensureCertDir();
  const filename = nombreArchivoCertificado(d, false);
  const filePath = path.join(CERT_DIR, filename);
  CertificadoPdfRenderer.renderToFile(d, filePath);
  return filePath;
}

async function emitirCertificadoCompleto(codigo) {
  const d = await obtenerDatosCertificado(codigo);
  if (!d) return { ok: false, error: 'Certificado no encontrado' };

  guardarHtmlCertificado(d);
  let pdfPath = null;
  try {
    pdfPath = generarPdfCertificado(d);
  } catch (e) {
    console.warn('PDF certificado:', e.message);
  }

  const correo = (d.correo || '').trim();
  return {
    ok: true,
    certificado_codigo: codigo,
    certificado_url: `certificado.html?codigo=${encodeURIComponent(codigo)}`,
    certificado_pdf: pdfPath ? `certificados/${path.basename(pdfPath)}` : null,
    pdf_api: `api/certificado_pdf.php?codigo=${encodeURIComponent(codigo)}`,
    email: {
      sent: !!correo,
      message: correo
        ? `Certificado disponible. El adoptante puede consultarlo en Mi solicitud (${correo}).`
        : 'Certificado generado. El adoptante puede consultarlo en Mi solicitud con su cédula.'
    }
  };
}

module.exports = {
  obtenerDatosCertificado,
  htmlCertificado,
  nombreArchivoCertificado,
  generarPdfCertificado,
  guardarHtmlCertificado,
  emitirCertificadoCompleto,
  CertificadoPdfRenderer
};
