# EC/TDS Calibration - Phase 21

## Fixed Model

- Physical calibration source: EC in `uS/cm`.
- Display/control conversion: TDS scale 500, factor `0.5`.
- `referenceTdsPpm = referenceEcUsCm * 0.5`.
- `temperatureFactor = 1 + 0.02 * (waterTemp - 25)`.
- `voltage25 = measuredVoltage / temperatureFactor`.
- Calibration method: piecewise-linear interpolation from voltage25 to EC.
- Extrapolation is forbidden for control. Outside the active range, EC and TDS are null.

## Calibration Set Lifecycle

1. Create a draft set and record the reference meter/session.
2. Add at least three points with distinct, increasing voltage25 and EC values.
3. Validate the draft. All points require valid temperature and ADC/voltage consistency.
4. Activate only after backend validation passes.
5. The active set is immutable. Create a new draft to recalibrate.
6. Retiring the active set clears the active pointer and disables Auto Dosing.

Legacy rows are retained for review but cannot become active automatically.

## Hanna HI70031 Packets

Two 1413 uS/cm packets have been ordered, but no measurement result exists yet.

1. Use packet one to verify the external EC meter. Record the meter result separately.
2. Create a draft set only after the measurement environment is ready.
3. Use packet two for one supervised 1413 uS/cm calibration point.
4. Do not save both packets as duplicate 1413 points in one set.
5. Obtain at least two additional distinct certified EC references before activation.

Two identical 1413 uS/cm references cannot satisfy the three-point monotonic requirement.
No active set may be created from the ordered packets until measurements are performed.

## Initial Stability Thresholds

- Firmware: 30 samples, 40 ms spacing, median, maximum raw spread 50.
- Backend: 3 valid payloads from the same active set within 120 seconds.
- Backend spread limit: `max(20 ppm, 3% of median ppm)`.

These are conservative software defaults, not experimentally validated limits. Review
real logs before unattended operation.
