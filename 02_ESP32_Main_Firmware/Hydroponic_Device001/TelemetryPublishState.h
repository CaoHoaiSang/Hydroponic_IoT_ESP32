#ifndef TELEMETRY_PUBLISH_STATE_H
#define TELEMETRY_PUBLISH_STATE_H

template <typename Text>
class TelemetryPublishState {
 public:
  TelemetryPublishState() : pending_(false) {}

  bool begin(const Text& payload, const Text& measurementId) {
    if (pending_) return false;
    payload_ = payload;
    measurementId_ = measurementId;
    pending_ = true;
    return true;
  }

  void recordPublishResult(bool published) {
    if (!published) return;
    payload_ = Text();
    measurementId_ = Text();
    pending_ = false;
  }

  bool pending() const { return pending_; }
  const Text& payload() const { return payload_; }
  const Text& measurementId() const { return measurementId_; }

 private:
  Text payload_;
  Text measurementId_;
  bool pending_;
};

#endif
