import { useState, type FC } from "react";
import type { AuditNoteView } from "@agent-office/control-ui/integration";
import { Card, SectionHeader } from "@agent-office/control-ui";

interface EvidencePanelProps {
  auditNotes: AuditNoteView[];
}

export const EvidencePanel: FC<EvidencePanelProps> = ({ auditNotes }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="panel-section" data-testid="evidence-panel">
      <SectionHeader title="Evidence" count={auditNotes.length} countIntent="info" />
      {auditNotes.length === 0 ? (
        <div className="panel-empty">No audit notes.</div>
      ) : (
        <div className="evidence-list">
          {auditNotes.map((note) => {
            const expanded = expandedId === note.auditId;
            return (
              <Card key={note.auditId} onClick={() => setExpandedId(expanded ? null : note.auditId)}>
                <div className="card-row">
                  <div>
                    <div className="card-title">{note.author}</div>
                    <div className="card-meta">{formatTime(note.createdAt)}{note.taskId ? ` · ${note.taskId}` : ""}</div>
                  </div>
                </div>
                <div className={expanded ? "card-body" : "card-body truncate"}>{note.body}</div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}
