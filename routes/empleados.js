const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM empleados ORDER BY apellidos, nombres');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM empleados WHERE id_empleado = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  const { nombres, apellidos, cargo, telefono, correo } = req.body;

  if (!nombres || !apellidos) {
    return res.status(400).json({ error: 'Nombres y apellidos son obligatorios' });
  }

  try {
    const [result] = await pool.query(`
      INSERT INTO empleados (nombres, apellidos, cargo, telefono, correo)
      VALUES (?, ?, ?, ?, ?)
    `, [nombres, apellidos, cargo || null, telefono || null, correo || null]);

    res.status(201).json({ message: 'Empleado registrado', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  const { nombres, apellidos, cargo, telefono, correo } = req.body;

  try {
    const [result] = await pool.query(`
      UPDATE empleados SET
        nombres = ?, apellidos = ?, cargo = ?, telefono = ?, correo = ?
      WHERE id_empleado = ?
    `, [nombres, apellidos, cargo, telefono, correo, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
    res.json({ message: 'Empleado actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [adopciones] = await pool.query(
      'SELECT id_adopcion FROM adopciones WHERE id_empleado = ?',
      [req.params.id]
    );

    if (adopciones.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar: el empleado tiene adopciones registradas'
      });
    }

    const [result] = await pool.query('DELETE FROM empleados WHERE id_empleado = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
    res.json({ message: 'Empleado eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
