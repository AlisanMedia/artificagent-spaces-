import {
  readSync,
  lstatSync,
  constants,
  openSync,
  closeSync,
  fstatSync,
} from "node:fs";
import { isAbsolute } from "node:path";
import { createPublicKey } from "node:crypto";
import { invariant } from "@/domain/platform";

/** Server-only secret-file support for the SAME runtime. No secret values or paths are returned as diagnostics. */
export function readPrivateBytes(path: string, maxBytes = 8192) {
  invariant(isAbsolute(path), "V01_ABSOLUTE_BINDING_REQUIRED", 403);
  const entry = lstatSync(path);
  invariant(
    entry.isFile() && !entry.isSymbolicLink(),
    "V01_REGULAR_BINDING_REQUIRED",
    403,
  );
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    invariant(
      info.isFile() &&
        info.size > 0 &&
        info.size <= maxBytes &&
        (info.mode & 0o077) === 0 &&
        info.uid === process.getuid?.() &&
        info.ino === entry.ino &&
        info.dev === entry.dev,
      "V01_PRIVATE_BINDING_PERMISSIONS",
      403,
    );
    // Bound the read itself, including a file that grows after fstat.
    const bytes = Buffer.alloc(maxBytes + 1);
    let length = 0;
    while (length <= maxBytes) {
      const count = readSync(fd, bytes, length, bytes.length - length, null);
      if (!count) break;
      length += count;
    }
    invariant(length > 0 && length <= maxBytes, "V01_BINDING_BYTE_LIMIT", 403);
    return bytes.subarray(0, length);
  } finally {
    closeSync(fd);
  }
}
export function readPrivateBinding(path: string, maxBytes = 8192) {
  return readPrivateBytes(path, maxBytes).toString("utf8");
}
function binding(name: string, env: NodeJS.ProcessEnv) {
  const inline = env[name],
    file = env[name + "_FILE"];
  invariant(!(inline && file), "V01_AMBIGUOUS_SECRET_BINDING", 403);
  return inline || (file ? readPrivateBinding(file) : undefined);
}
export function readFalSecret(env: NodeJS.ProcessEnv = process.env) {
  const value = binding("FAL_KEY", env);
  invariant(
    value &&
      value.length <= 4096 &&
      value === value.trim() &&
      [...value].every(
        (char) => char.charCodeAt(0) >= 33 && char.charCodeAt(0) <= 126,
      ),
    "V01_SERVER_SECRET_UNAVAILABLE",
    403,
  );
  return value;
}
export function readApproverPublicKey(env: NodeJS.ProcessEnv = process.env) {
  const value = binding("SPACES_V01_APPROVER_PUBLIC_KEY", env);
  if (!value) return undefined;
  invariant(
    value.includes("PUBLIC KEY") && !value.includes("PRIVATE KEY"),
    "V01_PUBLIC_VERIFICATION_KEY_ONLY",
    403,
  );
  invariant(
    createPublicKey(value).asymmetricKeyType === "ed25519",
    "V01_APPROVER_KEY_TYPE_DENIED",
    403,
  );
  return value;
}
export function falSecretStatus(
  env: NodeJS.ProcessEnv = process.env,
): "CONFIGURED" | "MISSING" {
  try {
    readFalSecret(env);
    return "CONFIGURED";
  } catch {
    return "MISSING";
  }
}
