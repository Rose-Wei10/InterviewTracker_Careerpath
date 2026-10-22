import { it, expect } from "vitest";
import { extractResumeText } from "../src/services/pdf";
import { pdfFixture } from "./pdf-fixture";
it("extracts real PDF text within worker limits", async () => {
  expect(await extractResumeText(await pdfFixture())).toContain("React");
});
