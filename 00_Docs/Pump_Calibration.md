# Pump Calibration - Hydroponic_IoT_ESP32

## Pump A/B Calibration Process

1. Use clean water.
2. Run pump for 60 seconds.
3. Measure output volume in ml.
4. Repeat 3 times.
5. Compute average ml.
6. Compute `flowRateMlPerSec = averageMl / 60`.
7. Use `durationMs = targetMl / flowRateMlPerSec * 1000`.

## Example

If pump A runs 60 seconds and outputs 48 ml:

```text
flowRate = 48 / 60 = 0.8 ml/s
```

To dose 5 ml:

```text
duration = 5 / 0.8 = 6.25 seconds = 6250 ms
```

## Current Phase Note

Do not implement automatic dosing yet. Only prepare and use calibration data for manual testing in later tasks.
