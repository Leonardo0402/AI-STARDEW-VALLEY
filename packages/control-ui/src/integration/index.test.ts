import { describe, it, expect } from "vitest";
import {
  emptyIntegrationProjection,
  projectIntegration,
  useIntegrationState,
  type IntegrationProjection,
  type IntegrationState,
} from "./index.js";

describe("integration barrel", () => {
  it("exports projection helpers", () => {
    expect(typeof emptyIntegrationProjection).toBe("function");
    expect(typeof projectIntegration).toBe("function");
  });

  it("exports useIntegrationState hook", () => {
    expect(typeof useIntegrationState).toBe("function");
  });

  it("exports IntegrationProjection and IntegrationState types", () => {
    const projection: IntegrationProjection = emptyIntegrationProjection();
    expect(projection.github).toBeNull();
    expect(projection.reviews).toBeNull();

    const satisfyTypeCheck = (state: IntegrationState) => state.projection;
    expect(typeof satisfyTypeCheck).toBe("function");
  });
});
