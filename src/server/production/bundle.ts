import { crc32 } from "node:zlib";
import { digest } from "../crypto";
import { Id, invariant } from "@/domain/platform";
export interface AcceptedBundleArtifact {
  id: string;
  organizationId: string;
  propertyId: string;
  revision: number;
  bytes: Uint8Array;
  sha256: string;
  mime: "image/png" | "video/mp4";
  createdBy: string;
  reviewerId: string;
  reviewedOutputSha256: string;
  state: "approved";
  revoked: boolean;
  disclosure: string;
}
/** Internal composition of trusted, already re-authorized stored records. Not a public admission API. */
export function buildApprovedListingBundle(
  artifacts: readonly AcceptedBundleArtifact[],
  scope: { organizationId: string; propertyId: string; revision: number },
) {
  invariant(
    artifacts.length > 0 && artifacts.length <= 12,
    "BUNDLE_COUNT_LIMIT",
    422,
  );
  invariant(
    new Set(artifacts.map((a) => a.id)).size === artifacts.length,
    "DUPLICATE_BUNDLE_ARTIFACT",
    409,
  );
  let total = 0;
  const entries = artifacts.map((a, index) => {
    Id.parse(a.id);
    invariant(
      a.organizationId === scope.organizationId &&
        a.propertyId === scope.propertyId &&
        a.revision === scope.revision,
      "BUNDLE_SCOPE_DENIED",
      403,
    );
    invariant(
      a.state === "approved" &&
        !a.revoked &&
        a.reviewerId &&
        a.reviewerId !== a.createdBy &&
        a.reviewedOutputSha256 === a.sha256 &&
        digest(a.bytes) === a.sha256 &&
        a.disclosure.length > 0 &&
        a.disclosure.length <= 500,
      "BUNDLE_APPROVAL_REQUIRED",
      403,
    );
    invariant(
      a.mime === "image/png" || a.mime === "video/mp4",
      "BUNDLE_FORMAT_DENIED",
      415,
    );
    total += a.bytes.length;
    invariant(
      a.bytes.length > 0 && total <= 52_428_800,
      "BUNDLE_SIZE_LIMIT",
      413,
    );
    return {
      name: `media-${String(index + 1).padStart(2, "0")}.${a.mime === "image/png" ? "png" : "mp4"}`,
      bytes: Buffer.from(a.bytes),
    };
  });
  entries.push({
    name: "provenance.json",
    bytes: Buffer.from(
      JSON.stringify(
        {
          version: "bundle.listing.v1",
          propertyId: scope.propertyId,
          revision: scope.revision,
          entries: artifacts.map((a, i) => ({
            filename: entries[i]!.name,
            sha256: a.sha256,
            disclosure: a.disclosure,
          })),
          independentBundleReleaseRequired: true,
        },
        null,
        2,
      ),
    ),
  });
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name),
      crc = crc32(entry.bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(0x0021, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(entry.bytes.length, 18);
    header.writeUInt32LE(entry.bytes.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, entry.bytes);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(0x0021, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(entry.bytes.length, 20);
    c.writeUInt32LE(entry.bytes.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += header.length + name.length + entry.bytes.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  const bytes = Buffer.concat([...local, directory, end]);
  return {
    bytes,
    sha256: digest(bytes),
    mime: "application/zip" as const,
    state: "QA_HOLD" as const,
    liveInferenceCalls: 0,
    requiresIndependentReview: true as const,
  };
}
