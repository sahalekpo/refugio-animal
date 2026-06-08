const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/especies', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM especies WHERE nombre_especie IN ('Perro', 'Gato') ORDER BY nombre_especie"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/estados', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM estados ORDER BY nombre_estado');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/disponibles', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_animales_disponibles');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.id_animal, a.nombre, e.nombre_especie, a.raza, a.sexo, a.edad,
             a.fecha_ingreso, a.descripcion, es.nombre_estado, a.id_especie, a.id_estado
      FROM animales a
      INNER JOIN especies e ON a.id_especie = e.id_especie
      INNER JOIN estados es ON a.id_estado = es.id_estado
      ORDER BY a.fecha_ingreso DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.*, e.nombre_especie, es.nombre_estado
      FROM animales a
      INNER JOIN especies e ON a.id_especie = e.id_especie
      INNER JOIN estados es ON a.id_estado = es.id_estado
      WHERE a.id_animal = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Animal no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  const { nombre, id_especie, raza, sexo, edad, fecha_ingreso, descripcion } = req.body;

  if (!nombre || !id_especie || !sexo || !fecha_ingreso) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    await pool.execute(
      'CALL sp_registrar_animal(?, ?, ?, ?, ?, ?, ?)',
      [nombre, id_especie, raza || null, sexo, edad || null, fecha_ingreso, descripcion || null]
    );
    res.status(201).json({ message: 'Animal registrado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  const { nombre, id_especie, raza, sexo, edad, fecha_ingreso, descripcion, id_estado } = req.body;

  try {
    const [result] = await pool.query(`
      UPDATE animales SET
        nombre = ?, id_especie = ?, raza = ?, sexo = ?, edad = ?,
        fecha_ingreso = ?, descripcion = ?, id_estado = ?
      WHERE id_animal = ?
    `, [nombre, id_especie, raza, sexo, edad, fecha_ingreso, descripcion, id_estado, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Animal no encontrado' });
    }
    res.json({ message: 'Animal actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [adopciones] = await pool.query(
      'SELECT id_adopcion FROM adopciones WHERE id_animal = ?',
      [req.params.id]
    );

    if (adopciones.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar: el animal tiene una adopción registrada'
      });
    }

    await pool.query('DELETE FROM historial_medico WHERE id_animal = ?', [req.params.id]);

    const [result] = await pool.query('DELETE FROM animales WHERE id_animal = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Animal no encontrado' });
    }
    res.json({ message: 'Animal eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
