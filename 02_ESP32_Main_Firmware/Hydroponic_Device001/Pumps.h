#ifndef PUMPS_H
#define PUMPS_H

void pumpsBegin();

void setPumpMain(bool on);
void setPumpA(bool on);
void setPumpB(bool on);
void setPumpSpare(bool on);
void turnAllPumpsOff();
void enforceActuatorSafetyLock();

bool getPumpMain();
bool getPumpA();
bool getPumpB();
bool getPumpSpare();

#endif
