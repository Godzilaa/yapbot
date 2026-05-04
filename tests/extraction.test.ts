import { describe, expect, it } from "vitest";
import { applyConfidenceReview, validateExtraction } from "../src/domain/extraction.js";

describe("extraction contract", () => {
  it("validates a minimal extraction", () => {
    const extraction = validateExtraction({
      meeting: {
        title: "Backend sync",
        startedAt: "2026-05-04T10:00:00.000Z"
      },
      tasks: [
        {
          title: "Create schema",
          confidence: 0.9
        }
      ]
    });

    expect(extraction.meeting.title).toBe("Backend sync");
    expect(extraction.tasks[0]?.status).toBe("open");
    expect(extraction.tasks[0]?.priority).toBe("normal");
  });

  it("marks low-confidence tasks and decisions as pending review", () => {
    const extraction = validateExtraction({
      meeting: {
        title: "Backend sync",
        startedAt: "2026-05-04T10:00:00.000Z"
      },
      tasks: [
        {
          title: "Draft summary format",
          confidence: 0.5
        }
      ],
      decisions: [
        {
          title: "Use Neo4j",
          confidence: 0.5
        }
      ]
    });

    const reviewed = applyConfidenceReview(extraction, 0.7);
    expect(reviewed.tasks[0]?.status).toBe("pending_review");
    expect(reviewed.decisions[0]?.status).toBe("pending_review");
  });
});
