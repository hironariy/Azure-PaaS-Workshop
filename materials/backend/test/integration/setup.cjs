const { randomUUID } = require('node:crypto');

require('../setup.cjs');

const port = process.env.WORKSHOP_TEST_MONGO_PORT;
if (!port || !/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65535) {
  throw new Error('WORKSHOP_TEST_MONGO_PORT must identify the isolated local MongoDB fixture (1-65535)');
}

process.env.COSMOS_CONNECTION_STRING =
  `mongodb://127.0.0.1:${port}/workshop-integration-${randomUUID()}`;
