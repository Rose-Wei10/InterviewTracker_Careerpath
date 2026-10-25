import { afterEach, expect, it, vi } from "vitest";
import {
  storeResume,
  resumeDownloadUrl,
  readResume,
  removeResume,
} from "../src/services/storage";
import { put, get, del, issueSignedToken, presignUrl } from "@vercel/blob";
vi.mock("@vercel/blob", () => ({
  put: vi.fn().mockResolvedValue({}),
  get: vi
    .fn()
    .mockImplementation(async () => ({
      statusCode: 200,
      blob: { size: 5 },
      stream: new Response("%PDF-").body,
    })),
  del: vi.fn().mockResolvedValue(undefined),
  issueSignedToken: vi
    .fn()
    .mockResolvedValue({
      delegationToken: "scoped",
      clientSigningToken: "secret",
    }),
  presignUrl: vi
    .fn()
    .mockResolvedValue({
      presignedUrl: "https://private.example.invalid/scoped",
    }),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("stores privately and scopes one-minute download access to one object", async () => {
  vi.stubEnv("BLOB_STORE_ID", "store-test");
  const pathname = "resumes/alice/unique.pdf",
    bytes = Buffer.from("%PDF-");
  const key = await storeResume(pathname, bytes);
  expect(key).toBe("vercel-blob:" + pathname);
  expect(put).toHaveBeenCalledWith(
    pathname,
    bytes,
    expect.objectContaining({ access: "private", addRandomSuffix: false }),
  );
  const now = Date.now();
  expect(await resumeDownloadUrl(key)).toBe(
    "https://private.example.invalid/scoped",
  );
  expect(issueSignedToken).toHaveBeenCalledWith({
    pathname,
    operations: ["get"],
    validUntil: expect.any(Number),
  });
  const expiry = vi.mocked(issueSignedToken).mock.calls[0][0]!.validUntil!;
  expect(expiry).toBeGreaterThanOrEqual(now + 60000);
  expect(expiry).toBeLessThanOrEqual(Date.now() + 60000);
  expect(presignUrl).toHaveBeenCalledWith(
    expect.any(Object),
    expect.objectContaining({
      pathname,
      operation: "get",
      access: "private",
      validUntil: expiry,
    }),
  );
  expect(await readResume(key)).toEqual(new Uint8Array(bytes));
  await removeResume(key);
  expect(del).toHaveBeenCalledWith(pathname);
});
it("rejects missing and oversized private objects before reading their content", async () => {
  vi.mocked(get).mockResolvedValueOnce(null);
  await expect(readResume("vercel-blob:missing.pdf")).rejects.toThrow(
    "could not be read",
  );
  vi.mocked(get).mockResolvedValueOnce({
    statusCode: 200,
    blob: { size: 6 * 1024 * 1024 },
  } as Awaited<ReturnType<typeof get>>);
  await expect(readResume("vercel-blob:large.pdf")).rejects.toThrow(
    "size limit",
  );
});
