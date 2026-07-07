import type { FC } from "react";
import type { ComposedOfficeProjection } from "@agent-office/control-ui/life-sim";

interface FocusModeIndicatorProps {
  projection: ComposedOfficeProjection;
}

export const FocusModeIndicator: FC<FocusModeIndicatorProps> = ({
  projection,
}) => {
  void projection;

  return (
    <div className="focus-indicator" data-testid="focus-indicator">
      <h2 className="focus-indicator__title">Focus Mode</h2>
      <p className="focus-indicator__hint">
        Agents continue working in the background; events queue quietly.
      </p>
      <p className="focus-indicator__hint">
        Switch to Command or Debrief for details.
      </p>
    </div>
  );
};
