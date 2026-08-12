#ifndef TELEMETRY_SEQUENCE_H
#define TELEMETRY_SEQUENCE_H

#include <stdint.h>

class TelemetrySequenceCounter {
 public:
  explicit TelemetrySequenceCounter(uint32_t initialValue = 0) : value_(initialValue) {}

  uint32_t next() {
    value_++;
    if (value_ == 0) value_ = 1;
    return value_;
  }

  uint32_t current() const { return value_; }

 private:
  uint32_t value_;
};

#endif
