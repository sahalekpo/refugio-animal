const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/dashboard', async (req, res) => {
  try {
    const [[{ total }]] = await pool.query('SELECT fn_total_adopciones() AS total');

    const [[{ total_animales }]] = await pool.query('SELECT COUNT(*) AS total_animales FROM animales');
    const [[{ disponibles }]] = await pool.query(`
      SELECT COUNT(*) AS disponibles FROM animales a
      INNER JOIN estados e ON a.id_estado = e.id_estado
      WHERE e.nombre_estado = 'Disponible'
    `);
    const [[{ total_adoptantes }]] = await pool.query('SELECT COUNT(*) AS total_adoptantes FROM adoptantes');
    const [[{ total_empleados }]] = await pool.query('SELECT COUNT(*) AS total_empleados FROM empleados');

    res.json({
      total_adopciones: total,
      total_animales,
      animales_disponibles: disponibles,
      total_adoptantes,
      total_empleados
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/animales-disponibles', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_animales_disponibles');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/historial-adopciones', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_historial_adopciones ORDER BY fecha_adopcion DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
