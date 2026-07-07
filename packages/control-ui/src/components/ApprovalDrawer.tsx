import { useRef, type FC, type KeyboardEvent, type MouseEvent } from "react";
import type { ApprovalView } from "@agent-office/protocol";
import type { OfficeSelection } from "@agent-office/pixel-office";
import { Card } from "./Card.js";

interface ApprovalDrawerProps {
  approvals: ApprovalView[];
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
  approveDisabled?: boolean;
  rejectDisabled?: boolean;
  selection?: OfficeSelection | null;
  onSelect?: (selection: OfficeSelection) => void;
  cardRef?: (approvalId: string) => (el: HTMLDivElement | null) => void;
}

export const ApprovalDrawer: FC<ApprovalDrawerProps> = ({
  approvals,
  onApprove,
  onReject,
  approveDisabled = false,
  rejectDisabled = false,
  selection = null,
  onSelect,
  cardRef,
}) => {
  const titleRef = useRef<HTMLHeadingElement>(null);

  if (approvals.length === 0) return null;

  const isSelected = (id: string): boolean =>
    selection?.kind === "approval" && selection?.id === id;

  const handleSelect = (id: string): void => {
    onSelect?.({ kind: "approval", id });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      titleRef.current?.focus();
      e.preventDefault();
    }
  };

  const handleCardKeyDown =
    (id: string) =>
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect?.({ kind: "approval", id });
      }
    };

  return (
    <div className="panel-section approval-drawer__container" onKeyDown={handleKeyDown}>
      <h3 className="approval-drawer__title" ref={titleRef} tabIndex={-1}>
        Pending Approval <span className="badge badge--count">{approvals.length}</span>
      </h3>
      {approvals.map((approval) => (
        <Card
          key={approval.approvalId}
          ref={cardRef?.(approval.approvalId)}
          className="approval-drawer"
          selectable={Boolean(onSelect)}
          selected={isSelected(approval.approvalId)}
          ariaLabel={`Select approval ${approval.approvalId}`}
          onClick={() => handleSelect(approval.approvalId)}
          onKeyDown={handleCardKeyDown(approval.approvalId)}
        >
          <div className="approval-drawer__meta">
            {approval.kind} · {approval.taskId}
            {approval.reason ? ` · ${approval.reason}` : ""}
          </div>
          <div className="approval-drawer__actions">
            <button
              className="btn btn--primary btn--small"
              aria-label={`Approve approval ${approval.approvalId}`}
              onClick={(e: MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                onApprove(approval.approvalId);
              }}
              disabled={approveDisabled}
            >
              Approve
            </button>
            <button
              className="btn btn--danger btn--small"
              aria-label={`Reject approval ${approval.approvalId}`}
              onClick={(e: MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                onReject(approval.approvalId);
              }}
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
