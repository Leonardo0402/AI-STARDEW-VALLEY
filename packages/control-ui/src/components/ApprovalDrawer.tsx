import type { FC } from "react";
import type { ApprovalView } from "@agent-office/protocol";
import { Card } from "./Card.js";

interface ApprovalDrawerProps {
  approvals: ApprovalView[];
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
  disabled?: boolean;
}

export const ApprovalDrawer: FC<ApprovalDrawerProps> = ({
  approvals,
  onApprove,
  onReject,
  disabled = false,
}) => {
  if (approvals.length === 0) return null;

  return (
    <div className="panel-section">
      {approvals.map((approval) => (
        <Card key={approval.approvalId} className="approval-drawer">
          <h3 className="approval-drawer__title">
            Pending Approval <span className="badge badge--count">{approvals.length}</span>
          </h3>
          <div className="approval-drawer__meta">
            {approval.kind} · {approval.taskId}
            {approval.reason ? ` · ${approval.reason}` : ""}
          </div>
          <div className="approval-drawer__actions">
            <button
              className="btn btn--primary btn--small"
              onClick={() => onApprove(approval.approvalId)}
              disabled={disabled}
            >
              Approve
            </button>
            <button
              className="btn btn--danger btn--small"
              onClick={() => onReject(approval.approvalId)}
              disabled={disabled}
            >
              Reject
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
};
