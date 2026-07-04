/**
 * Standalone SSE frame parser. Operates on strings (caller decodes bytes via
 * TextDecoder with stream:true to handle UTF-8 chunk boundaries).
 *
 * Spec: https://html.spec.whatwg.org/multipage/server-sent-events.html
 */
export interface SseParserHandlers {
  onEvent(eventType: string | undefined, id: string | undefined, data: string): void;
  onComment(text: string): void;
  onError(error: Error): void;
}

export interface SseParser {
  feed(chunk: string): void;
  finish(): void;
}

export function createSseParser(handlers: SseParserHandlers): SseParser {
  let buffer = "";
  let currentEvent: string | undefined = undefined;
  let currentId: string | undefined = undefined;
  let currentData: string[] = [];

  function dispatchFrame(): void {
    // Empty frame (no data, no event, no id) — per spec, still dispatches with empty data
    // But if data array is empty and no event/id, treat as no-op to avoid noise.
    if (currentData.length === 0 && currentEvent === undefined && currentId === undefined) {
      // reset for next frame
      currentEvent = undefined;
      currentId = undefined;
      currentData = [];
      return;
    }
    const data = currentData.join("\n");
    try {
      handlers.onEvent(currentEvent, currentId, data);
    } finally {
      // Per spec: event type resets after dispatch; id persists; data resets.
      currentEvent = undefined;
      currentData = [];
      // currentId persists per spec (Last-Event-ID), but for our use case we reset per frame
      // since each frame carries its own id.
      currentId = undefined;
    }
  }

  function processLine(line: string): void {
    if (line === "") {
      // blank line = frame dispatch
      dispatchFrame();
      return;
    }
    if (line.startsWith(":")) {
      // comment — per SSE spec, strip exactly one leading space after the colon
      // (Plan Review Fix 10, v3: previously `line.slice(1)` left the leading
      // space, so `: heartbeat` produced ` heartbeat` instead of `heartbeat`.)
      let comment = line.slice(1);
      if (comment.startsWith(" ")) comment = comment.slice(1);
      handlers.onComment(comment);
      return;
    }
    let field: string;
    let value: string;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      field = line;
      value = "";
    } else {
      field = line.slice(0, colonIdx);
      // per spec, if value starts with a space, strip exactly one leading space
      value = line.slice(colonIdx + 1);
      if (value.startsWith(" ")) value = value.slice(1);
    }
    switch (field) {
      case "event":
        currentEvent = value;
        break;
      case "data":
        currentData.push(value);
        break;
      case "id":
        currentId = value;
        break;
      case "retry":
        // ignored — we don't use server-suggested retry intervals
        break;
      default:
        // Per SSE spec, unknown fields MUST be ignored (not fatal).
        // (Plan Review Fix 11, v3: previously called handlers.onError, which
        // could trigger stream_protocol_error on servers sending extensions
        // like `:foo` or future SSE fields. Now silently ignored.)
        break;
    }
  }

  function feed(chunk: string): void {
    buffer += chunk;
    // Process complete lines (terminated by \n, \r\n, or \r)
    let idx: number;
    while ((idx = findLineEnd(buffer)) !== -1) {
      const line = buffer.slice(0, idx);
      // strip trailing \r if it was \r\n
      let lineContent = line;
      if (lineContent.endsWith("\r")) lineContent = lineContent.slice(0, -1);
      // advance buffer past the line terminator
      buffer = buffer.slice(idx + 1);
      processLine(lineContent);
    }
  }

  function finish(): void {
    // Per spec: if buffer ends without a blank line, the incomplete frame is dropped.
    // But if the buffer has content followed by what would be a frame terminator, process it.
    // We do NOT dispatch the partial frame.
    buffer = "";
  }

  return { feed, finish };
}

/** Find the index of the next \n or \r (line terminator). Returns -1 if none. */
function findLineEnd(s: string): number {
  const ln = s.indexOf("\n");
  if (ln !== -1) return ln; // \n found — handles \r\n and \n
  return s.indexOf("\r"); // bare \r only
}
