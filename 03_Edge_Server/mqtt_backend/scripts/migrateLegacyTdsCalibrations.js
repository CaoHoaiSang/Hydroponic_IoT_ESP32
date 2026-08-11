const dotenv = require('dotenv');

const { closeMongo, connectMongo } = require('../src/mongoClient');
const {
  getModernCalibrationPointReasons,
} = require('../src/validators/tdsCalibrationSetValidator');

function getLegacyReasons(row) {
  return getModernCalibrationPointReasons(row);
}

async function runLegacyMigration(database, { apply = false } = {}) {
  const collection = database.collection('tds_calibrations');
  const rows = await collection.find({}).toArray();
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    totalRowsScanned: rows.length,
    rowsRequiringAudit: 0,
    legacyRowsFound: 0,
    missingCalibrationSetId: 0,
    missingReferenceEc: 0,
    missingOrInvalidReferenceScale: 0,
    missingOrInvalidWaterTemperature: 0,
    rowsWithSetIdButIncomplete: 0,
    completeModernRows: 0,
    rowsMarkedLegacy: 0,
    reasonCounts: {},
  };

  for (const row of rows) {
    const reasons = getLegacyReasons(row);
    for (const reason of reasons) {
      summary.reasonCounts[reason] = (summary.reasonCounts[reason] || 0) + 1;
    }
    if (reasons.includes('missing_calibration_set_id')) summary.missingCalibrationSetId++;
    if (reasons.includes('missing_reference_ec')) summary.missingReferenceEc++;
    if (reasons.includes('missing_or_invalid_reference_scale')) summary.missingOrInvalidReferenceScale++;
    if (reasons.includes('missing_or_invalid_water_temperature')) summary.missingOrInvalidWaterTemperature++;
    if (reasons.length === 0) {
      summary.completeModernRows++;
      continue;
    }
    summary.rowsRequiringAudit++;
    summary.legacyRowsFound++;
    if (!reasons.includes('missing_calibration_set_id')) summary.rowsWithSetIdButIncomplete++;
    if (apply) {
      await collection.updateOne(
        { _id: row._id },
        { $set: { legacy: true, legacyReasons: reasons, legacyAuditedAt: new Date() } },
      );
      summary.rowsMarkedLegacy++;
    }
  }
  return summary;
}

async function main() {
  dotenv.config();
  const apply = process.argv.includes('--apply');
  const database = await connectMongo();
  const summary = await runLegacyMigration(database, { apply });
  console.log(JSON.stringify(summary, null, 2));
  await closeMongo();
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(`Legacy calibration migration failed: ${error.message}`);
    await closeMongo();
    process.exitCode = 1;
  });
}

module.exports = { getLegacyReasons, runLegacyMigration };
