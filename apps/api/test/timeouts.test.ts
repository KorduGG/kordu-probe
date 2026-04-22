import { describe, expect, it } from "vitest";

import { OperationTimeoutError } from "../src/lib/errors";
import { withTimeout } from "../src/lib/timeouts";

describe("withTimeout", () => {
  it("rejects slow operations with OperationTimeoutError", async () => {
    await expect(
      withTimeout(new Promise<never>(() => {}), 10, "DNS lookup timed out.")
    ).rejects.toBeInstanceOf(OperationTimeoutError);
  });
});
