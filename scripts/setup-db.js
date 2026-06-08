const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function prepareSql(content) {
  return content
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .replace(/^\s*USE\s+\w+\s*;/gim, '')
    .replace(/DELIMITER\s+\$\$/gi, '')
    .replace(/DELIMITER\s+;/gi, '')
    .replace(/\$\$/g, ';');
}

async function runFile(connection, filename) {
  const filePath = path.join(__dirname, '..', filename);
  if (!fs.existsSync(filePath)) return;

  let sql = prepareSql(fs.readFileSync(filePath, 'utf8'));
  if (filename === 'database.sql') {
    sql = sql.replace(/CREATE\s+DATABASE\s+refugio_animales\s*;/i, '');
  }

  await connection.query({ sql, multipleStatements: true });
  console.log(`OK: ${filename}`);
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  await connection.query('CREATE DATABASE IF NOT EXISTS refugio_animales');
  await connection.query('USE refugio_animales');

  const files = [
    'database.sql',
    'database_updates.sql',
    'database_v3.sql',
    'database_v4_features.sql'
  ];

  for (const file of files) {
    await runFile(connection, file);
  }

  await connection.query(`
    ALTER TABLE donaciones
    MODIFY estado ENUM('Nueva','Contactada','Aceptada','Rechazada','Cerrada') DEFAULT 'Nueva'
  `).catch(() => {});
  await connection.query(`
    ALTER TABLE voluntariados
    MODIFY estado ENUM('Nueva','Contactada','Activa','Aceptada','Rechazada','Cerrada') DEFAULT 'Nueva'
  `).catch(() => {});
  await connection.query('DROP TRIGGER IF EXISTS tr_estado_proceso_adopcion');

  const [tables] = await connection.query('SHOW TABLES');
  console.log(`Base de datos lista: ${tables.length} tablas`);
  await connection.end();
}

main().catch((err) => {
  console.error('Error al configurar MySQL:', err.message);
  process.exit(1);
});
