import { describe, expect, it } from "vitest";

import { classifyLoadError } from "@/lib/load-error";
import { ApiError, BackendNotConnectedError, BackendOfflineError } from "@/services/api";

describe("page load errors say what actually happened", () => {
  it("recognises an unreachable store server, also after the error was serialised for hydration", () => {
    expect(classifyLoadError(new BackendOfflineError())).toBe("offline");
    expect(classifyLoadError(JSON.parse(JSON.stringify({ name: new BackendOfflineError().name })))).toBe("offline");
  });
  it("treats 5xx answers as a server problem but not 4xx ones", () => {
    expect(classifyLoadError(new ApiError(503, "db_down", "x"))).toBe("server");
    expect(classifyLoadError(new ApiError(404, "not_found", "x"))).toBe("unknown");
  });
  it("tells an unconnected store apart from other failures", () => {
    expect(classifyLoadError(new BackendNotConnectedError())).toBe("not_connected");
    expect(classifyLoadError(new Error("boom"))).toBe("unknown");
    expect(classifyLoadError(undefined)).toBe("unknown");
  });
});
