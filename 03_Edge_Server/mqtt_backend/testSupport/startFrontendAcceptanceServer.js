process.env.NODE_ENV = 'test';
process.env.ACTUATORS_LOCKED = 'true';
process.env.PUMP_COMMANDS_ENABLED = 'false';
process.env.AUTO_DOSING_ENABLED = 'false';

const { buildHttpApp } = require('../src/httpServer');
const server = buildHttpApp().listen(4173, '127.0.0.1', () => console.log('HydroFlow acceptance server ready'));
function close() { server.close(() => process.exit(0)); }
process.on('SIGTERM', close);
process.on('SIGINT', close);
