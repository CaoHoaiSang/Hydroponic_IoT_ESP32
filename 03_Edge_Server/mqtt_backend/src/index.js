require('dotenv').config();

const { closeHttpServer, startHttpServer } = require('./httpServer');
const { closeMongo, connectMongo, ensureIndexes } = require('./mongoClient');
const { closeMqtt, connectMqtt } = require('./mqttClient');

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`${signal} received, shutting down...`);

  try {
    await closeHttpServer();
    await closeMqtt();
    await closeMongo();
    process.exit(0);
  } catch (error) {
    console.error('Shutdown failed:', error.message);
    process.exit(1);
  }
}

async function main() {
  const serviceName = process.env.SERVICE_NAME || 'hydroponic-mqtt-backend';

  console.log('Hydroponic MQTT Backend starting...');
  console.log(`Service: ${serviceName}`);

  await connectMongo();
  await ensureIndexes();
  connectMqtt();
  startHttpServer();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((error) => {
  console.error('Hydroponic MQTT Backend failed to start:', error.message);
  process.exit(1);
});
