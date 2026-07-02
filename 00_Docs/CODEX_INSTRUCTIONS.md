# Codex Instructions - Hydroponic_IoT_ESP32

Use these rules for future Codex tasks in this project.

1. Do not change the official pin map unless explicitly requested.
2. Do not implement pH sensor in the current phase.
3. Do not implement Zalo Bot in the current phase.
4. Do not implement AI Camera in the current phase.
5. Do not implement Adaptive Dosing in the current phase.
6. Do not implement full Auto Dosing yet.
7. Each task must be small and testable.
8. Each Arduino test sketch must focus on only one hardware function.
9. Main firmware must later use millis(), not long blocking delays.
10. Every MQTT payload must match the defined JSON format.
11. Every completed change must be recorded in PROJECT_STATUS_REPORT.md.
12. If a file is created or modified, list it in PROJECT_STATUS_REPORT.md.
13. If a task is not completed, clearly record what remains.
14. Never delete existing project files unless explicitly requested.
15. Keep credentials out of source code. Use Secrets.h.example and .env.example only.
