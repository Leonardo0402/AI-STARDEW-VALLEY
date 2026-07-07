import type { FC } from "react";
import type { ComposedOfficeProjection } from "@agent-office/control-ui/life-sim";

interface FocusModeIndicatorProps {
  projection: ComposedOfficeProjection;
}

export const FocusModeIndicator: FC<FocusModeIndicatorProps> = ({
  projection,
}) => {
  const pending = projection.pendingApprovals.length;
  const blocked = projection.blockedTasks.length;
  const failed =
    projection.agents.filter((a) => a.status === "failed").length +
    projection.tasks.filter((t) => t.status === "failed").length;

  return (
    <div className="focus-indicator" data-testid="focus-indicator">
      <h2 className="focus-indicator__title">Focus Mode</h2>
      <p className="focus-indicator__hint">
        Agents continue working in the background; events queue quietly.
      </p>
      <div className="focus-indicator__stats">
        <div className="focus-indicator__stat">
          <span
            className="focus-indicator__num focus-indicator__num--urgency"
            data-testid="focus-indicator-count"
          >
            {pending}
          </span>
          <span className="focus-indicator__label">Pending</span>
        </div>
        <div className="focus-indicator__stat">
          <span
            className="focus-indicator__num focus-indicator__num--urgency"
            data-testid="focus-indicator-count"
          >
            {blocked}
          </span>
          <span className="focus-indicator__label">Blocked</span>
        </div>
        <div className="focus-indicator__stat">
          <span
            className="focus-indicator__num focus-indicator__num--urgency"
            data-testid="focus-indicator-count"
          >
            {failed}
          </span>
          <span className="focus-indicator__label">Failed</span>
        </div>
      </div>
      <p className="focus-indicator__hint">
        Switch to Command or Debrief for details.
      </p>
    </div>
  );
};
