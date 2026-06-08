const pool = require('../config/db');

async function runDbMigrations() {
  try {
    await pool.query(`
      ALTER TABLE donaciones
      MODIFY estado ENUM('Nueva','Contactada','Aceptada','Rechazada','Cerrada') DEFAULT 'Nueva'
    `);
  } catch (_) { /* ya aplicado */ }

  try {
    await pool.query(`
      ALTER TABLE voluntariados
      MODIFY estado ENUM('Nueva','Contactada','Activa','Aceptada','Rechazada','Cerrada') DEFAULT 'Nueva'
    `);
  } catch (_) { /* ya aplicado */ }

  await pool.query('DROP TRIGGER IF EXISTS tr_estado_proceso_adopcion');
}

module.exports = { runDbMigrations };
