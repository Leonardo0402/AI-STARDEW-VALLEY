import type { FC } from "react";
import type { IssueQueueItem, PullRequestQueueItem } from "../integration/types.js";
import type { OfficeSelection } from "@agent-office/pixel-office";
import { Card } from "./Card.js";
import { SectionHeader } from "./SectionHeader.js";
import { Badge } from "./Badge.js";

interface QueuePanelProps {
  issues: IssueQueueItem[];
  pulls: PullRequestQueueItem[];
  selection: OfficeSelection | null;
  onSelect?: (selection: OfficeSelection) => void;
}

export const QueuePanel: FC<QueuePanelProps> = ({ issues, pulls, selection, onSelect }) => {
  const total = issues.length + pulls.length;
  return (
    <div className="panel-section" data-testid="queue-panel">
      <SectionHeader title="Issue / PR Queue" count={total} countIntent="info" />
      {total === 0 ? (
        <div className="panel-empty">No open items in queue.</div>
      ) : (
        <div className="queue-list">
          {issues.map((item) => (
            <Card
              key={item.taskId}
              selectable
              selected={selection?.kind === "task" && selection.id === item.taskId}
              ariaLabel={`Select issue ${item.number}`}
              onClick={() => onSelect?.({ kind: "task", id: item.taskId })}
            >
              <div className="card-row">
                <div>
                  <div className="card-title">#{item.number} {item.title}</div>
                  <div className="card-meta">{item.labels.join(", ") || "no labels"}</div>
                </div>
                <Badge intent={item.state === "open" ? "running" : "idle"}>
                  {item.state}
                </Badge>
              </div>
            </Card>
          ))}
          {pulls.map((item) => (
            <Card
              key={item.artifactId}
              selectable
              selected={selection?.kind === "artifact" && selection.id === item.artifactId}
              ariaLabel={`Select pull request ${item.number}`}
              onClick={() => onSelect?.({ kind: "artifact", id: item.artifactId })}
            >
              <div className="card-row">
                <div>
                  <div className="card-title">#{item.number} {item.title}</div>
                  <div className="card-meta">{item.labels.join(", ") || "no labels"}</div>
                </div>
                <Badge intent={item.state === "open" ? "running" : item.state === "merged" ? "approved" : "idle"}>
                  {item.draft ? "draft" : item.state}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
