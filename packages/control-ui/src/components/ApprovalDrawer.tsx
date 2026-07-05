import { useRef, type FC, type KeyboardEvent } from "react";
import type { ApprovalView } from "@agent-office/protocol";
import { Card } from "./Card.js";

interface ApprovalDrawerProps {
  approvals: ApprovalView[];
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
  approveDisabled?: boolean;
  rejectDisabled?: boolean;
}

export const ApprovalDrawer: FC<ApprovalDrawerProps> = ({
  approvals,
  onApprove,
  onReject,
  approveDisabled = false,
  rejectDisabled = false,
}) => {
  const titleRef = useRef<HTMLHeadingElement>(null);

  if (approvals.length === 0) return null;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      titleRef.current?.focus();
      e.preventDefault();
    }
  };

  return (
    <div className="panel-section approval-drawer__container" onKeyDown={handleKeyDown}>
      <h3 className="approval-drawer__title" ref={titleRef} tabIndex={-1}>
        Pending Approval <span className="badge badge--count">{approvals.length}</span>
      </h3>
      {approvals.map((approval) => (
        <Card key={approval.approvalId} className="approval-drawer">
          <div className="approval-drawer__meta">
            {approval.kind} · {approval.taskId}
            {approval.reason ? ` · ${approval.reason}` : ""}
          </div>
          <div className="approval-drawer__actions">
            <button
              className="btn btn--primary btn--small"
              aria-label={`Approve approval ${approval.approvalId}`}
              onClick={() => onApprove(approval.approvalId)}
              disabled={approveDisabled}
            >
              Approve
            </button>
            <button
              className="btn btn--danger btn--small"
              aria-label={`Reject approval ${approval.approvalId}`}
              onClick={() => onReject(approval.approvalId)}
              disabled={rejectDisabled}
            >
              Reject
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
};
