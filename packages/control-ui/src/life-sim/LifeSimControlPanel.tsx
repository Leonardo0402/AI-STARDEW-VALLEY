import { useState, type FC } from "react";
import type { LifeSimProjection } from "./projection.js";
import { Card } from "../components/Card.js";
import { Badge, type BadgeIntent } from "../components/Badge.js";
import { SectionHeader } from "../components/SectionHeader.js";
import { formatWorldTime } from "./format-time.js";
import "./life-sim-panel.css";

interface LifeSimControlPanelProps {
  projection: LifeSimProjection;
  onSendCommand: (commandType: string, payload: unknown) => Promise<void>;
}

export const LifeSimControlPanel: FC<LifeSimControlPanelProps> = ({
  projection,
  onSendCommand,
}) => {
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  const runAction = async (key: string, fn: () => Promise<void>): Promise<void> => {
    setActionErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionErrors((prev) => ({ ...prev, [key]: msg }));
      throw err;
    }
  };

  const handleStartDay = () =>
    runAction("start-day", () => onSendCommand("world.start_day", {}));

  const handleAdvanceTime = (minutes: number) =>
    runAction(`advance-${minutes}`, () =>
      onSendCommand("world.advance_time", { minutes })
    );

  const handleRunToEndOfDay = () =>
    runAction("run-to-eod", () => onSendCommand("world.run_to_end_of_day", {}));

  const handleEndDay = () =>
    runAction("end-day", () => onSendCommand("world.end_day", {}));

  const { capabilities, world, truncated, previousDaySummaries } = projection;
  const latestSummary = previousDaySummaries[previousDaySummaries.length - 1];

  return (
    <div className="life-sim-panel">
      <div className="panel-section">
        <SectionHeader title="World" />
        <Card>
          <div className="life-sim-panel__clock">
            <span className="life-sim-panel__time">{formatWorldTime(world.minuteOfDay)}</span>
            <span className="life-sim-panel__day">Day {world.day}</span>
            <Badge intent={phaseIntent(world.phase)}>{world.phase}</Badge>
            <Badge intent={statusIntent(world.status)}>{world.status}</Badge>
          </div>
          {truncated && (
            <div className="life-sim-panel__truncated">History truncated</div>
          )}
        </Card>
      </div>

      <div className="panel-section">
        <SectionHeader title="Actions" />
        <div className="life-sim-panel__actions">
          <button
            className="btn btn--secondary btn--small"
            onClick={handleStartDay}
            disabled={!capabilities.world.startDay}
          >
            Start Day
          </button>
          {actionErrors["start-day"] && (
            <div className="action-error">{actionErrors["start-day"]}</div>
          )}

          <button
            className="btn btn--secondary btn--small"
            onClick={() => handleAdvanceTime(30)}
            disabled={!capabilities.world.advanceTime}
          >
            Advance 30 min
          </button>
          <button
            className="btn btn--secondary btn--small"
            onClick={() => handleAdvanceTime(60)}
            disabled={!capabilities.world.advanceTime}
          >
            Advance 60 min
          </button>
          <button
            className="btn btn--secondary btn--small"
            onClick={() => handleAdvanceTime(120)}
            disabled={!capabilities.world.advanceTime}
          >
            Advance 120 min
          </button>
          {(actionErrors["advance-30"] || actionErrors["advance-60"] || actionErrors["advance-120"]) && (
            <div className="action-error">
              {actionErrors["advance-30"] ?? actionErrors["advance-60"] ?? actionErrors["advance-120"]}
            </div>
          )}

          <button
            className="btn btn--secondary btn--small"
            onClick={handleRunToEndOfDay}
            disabled={!capabilities.world.runToEndOfDay}
          >
            Run to EOD
          </button>
          {actionErrors["run-to-eod"] && (
            <div className="action-error">{actionErrors["run-to-eod"]}</div>
          )}

          <button
            className="btn btn--secondary btn--small"
            onClick={handleEndDay}
            disabled={!capabilities.world.endDay}
          >
            End Day
          </button>
          {actionErrors["end-day"] && (
            <div className="action-error">{actionErrors["end-day"]}</div>
          )}
        </div>
      </div>

      {latestSummary && (
        <div className="panel-section">
          <SectionHeader title={`Day ${latestSummary.day} summary`} />
          <Card>
            <div className="life-sim-panel__summary-row">
              Tasks: {latestSummary.taskCounts.created} created,{" "}
              {latestSummary.taskCounts.completed} completed,{" "}
              {latestSummary.taskCounts.blocked} blocked,{" "}
              {latestSummary.taskCounts.failed} failed
            </div>
            <div className="life-sim-panel__summary-row">
              Approvals: {latestSummary.approvalCounts.requested} requested,{" "}
              {latestSummary.approvalCounts.approved} approved,{" "}
              {latestSummary.approvalCounts.rejected} rejected
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

function phaseIntent(phase: LifeSimProjection["world"]["phase"]): BadgeIntent {
  switch (phase) {
    case "dawn":
      return "idle";
    case "morning":
    case "afternoon":
      return "running";
    case "evening":
      return "waiting";
    case "night":
      return "paused";
    default:
      return "info";
  }
}

function statusIntent(status: LifeSimProjection["world"]["status"]): BadgeIntent {
  switch (status) {
    case "not_started":
      return "idle";
    case "running":
      return "running";
    case "paused":
      return "paused";
    case "ending":
      return "waiting";
    default:
      return "info";
  }
}
