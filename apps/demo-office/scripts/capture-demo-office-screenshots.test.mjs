import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getIntegrationScenario, SCREENSHOT_STATE_NAMES } from "./screenshot-helpers.mjs";

describe("getIntegrationScenario", () => {
  it("returns the expected github and reviews shape for queue-populated", () => {
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

  it("returns the expected reviews shape for review-pending", () => {
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

  it("returns the expected audit notes shape for evidence-added", () => {
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

  it("returns empty arrays for the timeline scenario", () => {
    const result = getIntegrationScenario("timeline");
    assert.ok(result);
    assert.deepEqual(result.github, { issues: [], pulls: [], auditNotes: [] });
    assert.deepEqual(result.reviews, { assigned: [], submitted: [] });
  });

  it("returns null github/reviews for the none scenario", () => {
    const result = getIntegrationScenario("none");
    assert.equal(result.github, null);
    assert.equal(result.reviews, null);
  });
});

describe("SCREENSHOT_STATE_NAMES", () => {
  it("includes states 15–18 with the expected names", () => {
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
