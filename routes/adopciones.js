const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_historial_adopciones ORDER BY fecha_adopcion DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  const { id_animal, id_adoptante, id_empleado, fecha_adopcion } = req.body;

  if (!id_animal || !id_adoptante || !id_empleado || !fecha_adopcion) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const [animal] = await pool.query(`
      SELECT a.id_animal, es.nombre_estado
      FROM animales a
      INNER JOIN estados es ON a.id_estado = es.id_estado
      WHERE a.id_animal = ?
    `, [id_animal]);

    if (animal.length === 0) {
      return res.status(404).json({ error: 'Animal no encontrado' });
    }

    if (animal[0].nombre_estado !== 'Disponible') {
      return res.status(400).json({
        error: `El animal no está disponible (estado: ${animal[0].nombre_estado})`
      });
    }

    const [existente] = await pool.query(
      'SELECT id_adopcion FROM adopciones WHERE id_animal = ?',
      [id_animal]
    );

    if (existente.length > 0) {
      return res.status(400).json({ error: 'Este animal ya fue adoptado' });
    }

    await pool.query(`
      INSERT INTO adopciones (id_animal, id_adoptante, id_empleado, fecha_adopcion)
      VALUES (?, ?, ?, ?)
    `, [id_animal, id_adoptante, id_empleado, fecha_adopcion]);

    res.status(201).json({
      message: 'Adopción registrada. El estado del animal se actualizó automáticamente.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [adopcion] = await pool.query(
      'SELECT id_animal FROM adopciones WHERE id_adopcion = ?',
      [req.params.id]
    );

    if (adopcion.length === 0) {
      return res.status(404).json({ error: 'Adopción no encontrada' });
    }

    await pool.query('DELETE FROM adopciones WHERE id_adopcion = ?', [req.params.id]);

    const [estadoDisponible] = await pool.query(
      "SELECT id_estado FROM estados WHERE nombre_estado = 'Disponible'"
    );

    if (estadoDisponible.length > 0) {
      await pool.query(
        'UPDATE animales SET id_estado = ? WHERE id_animal = ?',
        [estadoDisponible[0].id_estado, adopcion[0].id_animal]
      );
    }

    res.json({ message: 'Adopción eliminada y animal restaurado a Disponible' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
