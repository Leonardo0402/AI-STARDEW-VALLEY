import { useState, type FC, type MouseEvent } from "react";
import type { ReviewAssignment, ReviewDraft } from "@agent-office/core";
import { Card } from "./Card.js";
import { SectionHeader } from "./SectionHeader.js";
import { formatTime } from "./format-time.js";

interface ReviewBlockerProps {
  assigned: ReviewAssignment[];
  submitted: ReviewDraft[];
  onSendCommand: (commandType: string, payload: unknown) => Promise<void>;
}

export const ReviewBlocker: FC<ReviewBlockerProps> = ({ assigned, submitted, onSendCommand }) => {
  const [actingId, setActingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const total = assigned.length + submitted.length;

  const runAction = async (reviewId: string, commandType: string, payload: unknown) => {
    setActingId(reviewId);
    setErrorId(null);
    try {
      await onSendCommand(commandType, payload);
    } catch {
      setErrorId(reviewId);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="panel-section" data-testid="review-blocker">
      <SectionHeader title="Review Blocker" count={total} countIntent={submitted.length > 0 ? "waiting" : "info"} />
      {total === 0 ? (
        <div className="panel-empty">No active reviews.</div>
      ) : (
        <div className="review-list">
          {assigned.map((r) => (
            <Card key={r.reviewId}>
              <div className="card-title">{r.agentId} reviewing #{r.targetNumber}</div>
              <div className="card-meta">assigned {formatTime(r.assignedAt)}</div>
            </Card>
          ))}
          {submitted.map((r) => (
            <Card key={r.reviewId}>
              <div className="card-row">
                <div>
                  <div className="card-title">{r.verdict} #{r.targetNumber}</div>
                  <div className="card-meta">{r.comment.slice(0, 60) || "no comment"}</div>
                </div>
                <div className="card-actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--small"
                    disabled={actingId === r.reviewId}
                    onClick={(e: MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      void runAction(r.reviewId, "REVIEW_APPROVE", { reviewId: r.reviewId });
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--small"
                    disabled={actingId === r.reviewId}
                    onClick={(e: MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      void runAction(r.reviewId, "REVIEW_REJECT", { reviewId: r.reviewId, reason: "Rejected via UI" });
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
              {errorId === r.reviewId && <div className="card-error">Action failed</div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
