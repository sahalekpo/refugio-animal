const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { runDbMigrations } = require('./dbMigrations');

async function ensureAdminUser() {
  await runDbMigrations();
  const hash = bcrypt.hashSync('Admin2025!', 10);
  const [rows] = await pool.query('SELECT id_usuario FROM usuarios WHERE usuario = ?', ['admin']);
  if (rows.length) {
    await pool.query('UPDATE usuarios SET contrasena = ?, rol = ? WHERE usuario = ?', [hash, 'Administrador', 'admin']);
  } else {
    await pool.query('INSERT INTO usuarios (usuario, contrasena, rol) VALUES (?, ?, ?)', ['admin', hash, 'Administrador']);
  }
}

module.exports = { ensureAdminUser };
