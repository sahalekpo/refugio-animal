const express = require('express');
const fs = require('fs');
const {
  obtenerDatosCertificado,
  nombreArchivoCertificado,
  generarPdfCertificado,
  CertificadoPdfRenderer
} = require('../../lib/certificadoService');
const { jsonResponse } = require('../../lib/apiHelpers');

const router = express.Router();

router.get('/certificado.php', async (req, res) => {
  try {
    const codigo = req.query.codigo;
    if (!codigo) return jsonResponse(res, { error: 'Código requerido' }, 400);
    const row = await obtenerDatosCertificado(codigo);
    if (!row) return jsonResponse(res, { error: 'Certificado no encontrado' }, 404);
    return jsonResponse(res, row);
  } catch (e) {
    return jsonResponse(res, { error: e.message }, 500);
  }
});

router.get('/certificado_pdf.php', async (req, res) => {
  try {
    const codigo = req.query.codigo;
    if (!codigo) {
      res.status(400).send('Código requerido');
      return;
    }
    const d = await obtenerDatosCertificado(codigo);
    if (!d) {
      res.status(404).send('Certificado no encontrado');
      return;
    }

    let pdfPath = null;
    try {
      pdfPath = generarPdfCertificado(d);
    } catch {
      const buffer = CertificadoPdfRenderer.renderToBuffer(d);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivoCertificado(d, true)}"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(buffer);
    }

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      res.status(500).send('No se pudo generar el PDF');
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivoCertificado(d, true)}"`);
    res.setHeader('Content-Length', fs.statSync(pdfPath).size);
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(pdfPath).pipe(res);
  } catch (e) {
    res.status(500).send(`Error: ${e.message}`);
  }
});

module.exports = router;
