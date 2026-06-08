const express = require('express');
const core = require('./core');
const crud = require('./crud');
const extended = require('./extended');
const certificado = require('./certificado');

const router = express.Router();

router.use(certificado);
router.use(core);
router.use(crud);
router.use(extended);

module.exports = router;
