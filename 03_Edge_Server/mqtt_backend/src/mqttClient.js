const mqtt = require('mqtt');

const { savePumpStatusPayload } = require('./services/pumpLogService');
const { processTelemetryPayload } = require('./services/telemetryPipelineService');

let mqttClient = null;

function buildMqttOptions() {
  const username = process.env.MQTT_USERNAME || '';
  const password = process.env.MQTT_PASSWORD || '';
  const options = {};

  if (username.length > 0) {
    options.username = username;
    options.password = password;
  }

  return options;
}

function connectMqtt() {
  const mqttUrl = process.env.MQTT_URL || 'mqtt://127.0.0.1:1883';
  const sensorTopic = process.env.MQTT_TOPIC_SENSOR || 'hydroponic/device001/sensor';
  const pumpStatusTopic = process.env.MQTT_TOPIC_PUMP_STATUS || 'hydroponic/device001/pump/status';

  mqttClient = mqtt.connect(mqttUrl, buildMqttOptions());

  mqttClient.on('connect', () => {
    console.log('MQTT connected');

    mqttClient.subscribe([sensorTopic, pumpStatusTopic], (error) => {
      if (error) {
        console.error('MQTT subscribe failed:', error.message);
        return;
      }

      console.log(`Subscribed to ${sensorTopic}`);
      console.log(`Subscribed to ${pumpStatusTopic}`);
    });
  });

  mqttClient.on('reconnect', () => {
    console.log('MQTT reconnecting');
  });

  mqttClient.on('error', (error) => {
    console.error('MQTT error:', error.message);
  });

  mqttClient.on('close', () => {
    console.log('MQTT connection closed');
  });

  mqttClient.on('message', async (topic, message) => {
    console.log(`MQTT message received on ${topic}`);

    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch (error) {
      console.warn('MQTT JSON parse failed:', error.message);
      return;
    }

    try {
      let result;

      if (topic === sensorTopic) {
        result = await processTelemetryPayload(payload, topic);
        if (result.telemetry.ok) {
          console.log(`Telemetry ${result.telemetry.reason}: ${payload.measurementId || 'legacy'}`);
          if (result.shadow.saved) console.log(`Shadow decision saved: ${result.shadow.data.decision}`);
        }

        return;
      }

      if (topic === pumpStatusTopic) {
        result = await savePumpStatusPayload(payload, topic);

        if (result.ok) {
          console.log(`Pump status saved, insertedId: ${result.insertedId}`);
        }

        return;
      }

      console.warn(`Unhandled MQTT topic: ${topic}`);
    } catch (error) {
      console.error('Failed to handle MQTT payload:', error.message);
    }
  });

  return mqttClient;
}

function publishPumpCommand(command) {
  if (!mqttClient || !mqttClient.connected) {
    return Promise.reject(new Error('MQTT client is not connected'));
  }

  const topic = process.env.MQTT_TOPIC_PUMP_CMD || 'hydroponic/device001/pump/cmd';
  const payload = JSON.stringify(command);

  return new Promise((resolve, reject) => {
    mqttClient.publish(topic, payload, { qos: 0 }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      console.log(`Pump command published to ${topic}: ${command.commandId}`);
      resolve(true);
    });
  });
}

function closeMqtt() {
  if (!mqttClient) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    mqttClient.end(false, () => {
      mqttClient = null;
      console.log('MQTT client closed');
      resolve();
    });
  });
}

function isMqttConnected() {
  return Boolean(mqttClient && mqttClient.connected);
}

module.exports = {
  connectMqtt,
  closeMqtt,
  isMqttConnected,
  publishPumpCommand,
};
