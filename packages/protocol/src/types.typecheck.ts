import type {
  RuntimeStreamState,
  RuntimeErrorCode,
  RuntimeStreamError,
  RuntimeStreamObserver,
  RuntimeSubscription,
  DomainEvent,
} from "./index.js";

// RuntimeStreamState covers all lifecycle phases (no "reconnecting" — Session owns reconnect)
const state = "opening" satisfies RuntimeStreamState;
const state2 = "ready" satisfies RuntimeStreamState;
const state3 = "reset_required" satisfies RuntimeStreamState;
const state4 = "error" satisfies RuntimeStreamState;
const state5 = "closed" satisfies RuntimeStreamState;

// RuntimeErrorCode covers all typed remote errors
const code = "http_error" satisfies RuntimeErrorCode;
const code2 = "authentication_failed" satisfies RuntimeErrorCode;
const code3 = "snapshot_invalid" satisfies RuntimeErrorCode;
const code4 = "capabilities_invalid" satisfies RuntimeErrorCode;
const code5 = "stream_open_failed" satisfies RuntimeErrorCode;
const code6 = "stream_protocol_error" satisfies RuntimeErrorCode;
const code7 = "event_invalid" satisfies RuntimeErrorCode;
const code8 = "event_log_trimmed" satisfies RuntimeErrorCode;
const code9 = "command_rejected" satisfies RuntimeErrorCode;
const code10 = "command_response_invalid" satisfies RuntimeErrorCode;
const code11 = "aborted" satisfies RuntimeErrorCode;

// RuntimeStreamError shape (status is optional)
const err = {
  code: "http_error",
  message: "bad gateway",
  recoverable: false,
  status: 502,
} satisfies RuntimeStreamError;
const errNoStatus = {
  code: "aborted",
  message: "closed before ready",
  recoverable: false,
} satisfies RuntimeStreamError;

// RuntimeStreamObserver: onEvent required, onState/onError optional
const observer = {
  onEvent: (_e: DomainEvent) => {},
} satisfies RuntimeStreamObserver;
const observerFull = {
  onEvent: (_e: DomainEvent) => {},
  onState: (_s: RuntimeStreamState) => {},
  onError: (_e: RuntimeStreamError) => {},
} satisfies RuntimeStreamObserver;

// RuntimeSubscription: ready is a Promise, close returns void|Promise
const subscription = {
  ready: Promise.resolve(),
  close: () => {},
} satisfies RuntimeSubscription;
const subscriptionAsyncClose = {
  ready: Promise.resolve(),
  close: async () => {},
} satisfies RuntimeSubscription;

// Suppress unused-variable warnings
void state; void state2; void state3; void state4; void state5;
void code; void code2; void code3; void code4; void code5;
void code6; void code7; void code8; void code9; void code10; void code11;
void err; void errNoStatus;
void observer; void observerFull;
void subscription; void subscriptionAsyncClose;
