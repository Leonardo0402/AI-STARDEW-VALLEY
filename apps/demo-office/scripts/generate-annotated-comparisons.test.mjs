import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ANNOTATIONS, buildHtml } from "./screenshot-helpers.mjs";

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

  it("keeps coordinates within a reasonable 1440×900 viewport", () => {
    const MARGIN = 60;
    for (const item of ANNOTATIONS) {
      for (const note of item.notes) {
        assert.ok(
          note.x >= -MARGIN && note.x <= 1440 + MARGIN,
          `${item.name} note x=${note.x} out of range`
        );
        assert.ok(
          note.y >= -MARGIN && note.y <= 900 + MARGIN,
          `${item.name} note y=${note.y} out of range`
        );
      }
    }
  });
});

describe("buildHtml", () => {
  it("produces a valid HTML string for an annotation item", () => {
    const item = ANNOTATIONS.find((a) => a.name === "15-queue-populated");
    const html = buildHtml(item);
    assert.ok(html.startsWith("<!DOCTYPE html>"));
    assert.ok(html.includes("<html"));
    assert.ok(html.includes(item.title));
    assert.ok(html.includes("QueuePanel"));
    assert.ok(html.includes("<svg"));
    assert.ok(html.includes("<foreignObject"));
  });
});
