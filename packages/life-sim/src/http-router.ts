import type { IncomingMessage, ServerResponse } from "node:http";
import type { LifeSimEngine, LifeSimEvent } from "./types.js";

export interface LifeSimRouter {
  handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function formatSseEvent(event: LifeSimEvent): string {
  return `event: life-sim-event\nid: ${event.lifeSimSequence}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function createLifeSimRouter(engine: LifeSimEngine): LifeSimRouter {
  const worldId = engine.getSnapshot().worldId;
  const liveResponses = new Set<ServerResponse>();

  engine.onLifeSimEvent((event) => {
    const message = formatSseEvent(event);
    for (const res of liveResponses) {
      res.write(message);
    }
  });

  const endResponse = (res: ServerResponse): void => {
    if (!res.writableEnded) {
      res.end();
    }
    liveResponses.delete(res);
  };

  const handleSnapshot = (res: ServerResponse): void => {
    sendJson(res, 200, engine.getSnapshot());
  };

  const handleEvents = (req: IncomingMessage, res: ServerResponse, query: URLSearchParams): void => {
    const afterParam = query.get("afterLifeSimSequence");
    const afterLifeSimSequence = afterParam !== null ? Number(afterParam) : 0;
    if (!Number.isFinite(afterLifeSimSequence)) {
      sendError(res, 400, "Invalid afterLifeSimSequence");
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(":ok\n\n");

    liveResponses.add(res);

    const snapshot = engine.getSnapshot();
    for (const event of snapshot.eventLogTail) {
      if (event.lifeSimSequence > afterLifeSimSequence) {
        res.write(formatSseEvent(event));
      }
    }

    const cleanup = (): void => {
      endResponse(res);
    };

    req.on("close", cleanup);
    res.on("close", cleanup);
    res.on("error", cleanup);
  };

  const handleCommand = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    let body: string;
    try {
      body = await readBody(req);
    } catch (err) {
      sendError(res, 400, "Failed to read request body");
      return;
    }

    let command: unknown;
    try {
      command = JSON.parse(body);
    } catch {
      sendError(res, 400, "Invalid JSON body");
      return;
    }

    try {
      const result = await engine.execute(command as Parameters<LifeSimEngine["execute"]>[0]);
      sendJson(res, 200, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      sendError(res, 500, message);
    }
  };

  const router: LifeSimRouter = {
    handle: async (req, res) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const pathParts = url.pathname.split("/").filter(Boolean);

      if (pathParts.length < 3 || pathParts[0] !== "life-sim") {
        sendError(res, 404, "Not found");
        return;
      }

      const requestedWorldId = pathParts[1];
      const action = pathParts[2];

      if (requestedWorldId !== worldId) {
        sendError(res, 404, "World not found");
        return;
      }

      if (req.method === "GET" && action === "snapshot") {
        handleSnapshot(res);
        return;
      }

      if (req.method === "GET" && action === "events") {
        handleEvents(req, res, url.searchParams);
        return;
      }

      if (req.method === "POST" && action === "command") {
        await handleCommand(req, res);
        return;
      }

      sendError(res, 404, "Not found");
    },
  };

  return router;
}
