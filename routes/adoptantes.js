const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM adoptantes ORDER BY apellidos, nombres');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM adoptantes WHERE id_adoptante = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Adoptante no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  const { nombres, apellidos, cedula, telefono, correo, direccion } = req.body;

  if (!nombres || !apellidos || !cedula) {
    return res.status(400).json({ error: 'Nombres, apellidos y cédula son obligatorios' });
  }

  try {
    const [result] = await pool.query(`
      INSERT INTO adoptantes (nombres, apellidos, cedula, telefono, correo, direccion)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [nombres, apellidos, cedula, telefono || null, correo || null, direccion || null]);

    res.status(201).json({ message: 'Adoptante registrado', id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe un adoptante con esa cédula' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  const { nombres, apellidos, cedula, telefono, correo, direccion } = req.body;

  try {
    const [result] = await pool.query(`
      UPDATE adoptantes SET
        nombres = ?, apellidos = ?, cedula = ?, telefono = ?, correo = ?, direccion = ?
      WHERE id_adoptante = ?
    `, [nombres, apellidos, cedula, telefono, correo, direccion, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Adoptante no encontrado' });
    }
    res.json({ message: 'Adoptante actualizado correctamente' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe un adoptante con esa cédula' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [adopciones] = await pool.query(
      'SELECT id_adopcion FROM adopciones WHERE id_adoptante = ?',
      [req.params.id]
    );

    if (adopciones.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar: el adoptante tiene adopciones registradas'
      });
    }

    const [result] = await pool.query('DELETE FROM adoptantes WHERE id_adoptante = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Adoptante no encontrado' });
    }
    res.json({ message: 'Adoptante eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
