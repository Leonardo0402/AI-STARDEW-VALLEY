import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ANNOTATIONS,
  buildHtml,
  getIntegrationScenario,
  SCREENSHOT_STATE_NAMES,
} from "./screenshot-helpers.mjs";

describe("getIntegrationScenario", () => {
  it("returns issues and PRs for queue-populated", () => {
    const result = getIntegrationScenario("queue-populated");
    assert.ok(result);
    assert.ok(result.github);
    assert.equal(result.github.issues.length, 2);
    assert.equal(result.github.pulls.length, 1);
    assert.deepEqual(result.github.auditNotes, []);
    assert.deepEqual(result.reviews, { assigned: [], submitted: [] });

    const issue = result.github.issues[0];
    assert.equal(issue.taskId, "gh-issue-1");
    assert.equal(issue.number, 42);
    assert.equal(issue.kind, "issue");
    assert.equal(issue.title, "Fix login crash");
    assert.equal(issue.state, "open");
    assert.equal(issue.closedAt, null);
    assert.deepEqual(issue.labels, ["bug", "p1"]);
    assert.deepEqual(issue.assignees, ["alice"]);
    assert.equal(issue.url, "https://github.com/org/repo/issues/42");

    const pr = result.github.pulls[0];
    assert.equal(pr.taskId, "gh-pr-1");
    assert.equal(pr.number, 101);
    assert.equal(pr.kind, "pr");
    assert.equal(pr.state, "open");
    assert.equal(pr.draft, false);
  });

  it("returns assigned and submitted reviews for review-pending", () => {
    const result = getIntegrationScenario("review-pending");
    assert.ok(result);
    assert.deepEqual(result.github, { issues: [], pulls: [], auditNotes: [] });
    assert.equal(result.reviews.assigned.length, 1);
    assert.equal(result.reviews.submitted.length, 1);

    const assigned = result.reviews.assigned[0];
    assert.equal(assigned.reviewId, "review-1");
    assert.equal(assigned.targetKind, "pr");
    assert.equal(assigned.targetNumber, 101);
    assert.equal(assigned.agentId, "agent-reviewer");
    assert.equal(typeof assigned.assignedAt, "string");

    const submitted = result.reviews.submitted[0];
    assert.equal(submitted.reviewId, "review-2");
    assert.equal(submitted.verdict, "approved");
    assert.equal(submitted.targetKind, "pr");
    assert.equal(submitted.targetNumber, 102);
    assert.equal(typeof submitted.submittedAt, "string");
  });

  it("returns audit notes for evidence-added", () => {
    const result = getIntegrationScenario("evidence-added");
    assert.ok(result);
    assert.deepEqual(result.github.issues, []);
    assert.deepEqual(result.github.pulls, []);
    assert.equal(result.github.auditNotes.length, 2);

    const note = result.github.auditNotes[0];
    assert.equal(note.auditId, "audit-1");
    assert.equal(note.taskId, "task-1");
    assert.equal(note.body, "Verified reproduction steps and attached logs.");
    assert.equal(note.author, "agent-worker-1");
    assert.equal(typeof note.createdAt, "string");
  });

  it("returns empty integration data for timeline (timeline-visible)", () => {
    const result = getIntegrationScenario("timeline");
    assert.ok(result);
    assert.deepEqual(result.github, { issues: [], pulls: [], auditNotes: [] });
    assert.deepEqual(result.reviews, { assigned: [], submitted: [] });
  });

  it("returns null integration data for none (empty)", () => {
    const result = getIntegrationScenario("none");
    assert.equal(result.github, null);
    assert.equal(result.reviews, null);
  });

  it("falls back to null integration data for unknown scenarios", () => {
    const result = getIntegrationScenario("unknown-scenario");
    assert.equal(result.github, null);
    assert.equal(result.reviews, null);
  });
});

describe("SCREENSHOT_STATE_NAMES", () => {
  it("includes the four integration states 15–18", () => {
    assert.deepEqual(SCREENSHOT_STATE_NAMES, [
      "15-queue-populated",
      "16-review-pending",
      "17-evidence-added",
      "18-timeline-visible",
    ]);
  });

  it("produces valid state name strings", () => {
    for (const name of SCREENSHOT_STATE_NAMES) {
      assert.match(name, /^\d{2}-[a-z-]+$/);
    }
  });
});

describe("ANNOTATIONS", () => {
  it("includes entries for states 15–18", () => {
    const names = ANNOTATIONS.map((a) => a.name);
    assert.ok(names.includes("15-queue-populated"));
    assert.ok(names.includes("16-review-pending"));
    assert.ok(names.includes("17-evidence-added"));
    assert.ok(names.includes("18-timeline-visible"));
  });

  it("labels QueuePanel, ReviewBlocker, EvidencePanel, and TimelinePanel", () => {
    const labels = ANNOTATIONS.flatMap((a) => a.notes.map((n) => n.label)).join(" ");
    assert.match(labels, /QueuePanel/);
    assert.match(labels, /ReviewBlocker/);
    assert.match(labels, /EvidencePanel/);
    assert.match(labels, /TimelinePanel/);
  });

  it("labels the four canvas props", () => {
    const labels = ANNOTATIONS.flatMap((a) => a.notes.map((n) => n.label)).join(" ");
    assert.match(labels, /Mission Board/);
    assert.match(labels, /Review Desk/);
    assert.match(labels, /Filing Cabinet/);
    assert.match(labels, /Wall Scroll/);
  });

  it("keeps coordinates within the 1440×900 viewport", () => {
    for (const item of ANNOTATIONS) {
      for (const note of item.notes) {
        assert.ok(
          note.x >= 0 && note.x <= 1440,
          `${item.name} note x=${note.x} out of range`
        );
        assert.ok(
          note.y >= 0 && note.y <= 900,
          `${item.name} note y=${note.y} out of range`
        );
      }
    }
  });
});

describe("buildHtml", () => {
  it("produces output containing expected panel/prop labels and annotation boxes", () => {
    const item = ANNOTATIONS.find((a) => a.name === "15-queue-populated");
    const html = buildHtml(item);

    assert.ok(html.startsWith("<!DOCTYPE html>"));
    assert.ok(html.includes("<html"));
    assert.ok(html.includes("<svg"));
    assert.ok(html.includes("<foreignObject"));
    assert.ok(html.includes(item.title));
    assert.ok(html.includes("QueuePanel"));
    assert.ok(html.includes("Mission Board"));
  });

  for (const stateName of SCREENSHOT_STATE_NAMES) {
    it(`includes annotation markup for ${stateName}`, () => {
      const item = ANNOTATIONS.find((a) => a.name === stateName);
      assert.ok(item, `annotation entry for ${stateName} not found`);
      const html = buildHtml(item);
      assert.ok(html.includes(item.title));
      for (const note of item.notes) {
        assert.ok(html.includes(note.label));
      }
    });
  }
});
