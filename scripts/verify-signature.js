import { createPublicKey, verify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(resolve(repositoryRoot, "PatreonConfig.json"), "utf8"));
const script = await readFile(resolve(repositoryRoot, "PatreonScript.js"));

if (!config.scriptPublicKey || !config.scriptSignature) {
    throw new Error("PatreonConfig.json is unsigned. Run `npm run sign`.");
}

const publicKey = createPublicKey({
    key: Buffer.from(config.scriptPublicKey, "base64"),
    type: "spki",
    format: "der",
});
const isValid = verify(
    "RSA-SHA512",
    script,
    publicKey,
    Buffer.from(config.scriptSignature, "base64"),
);

if (!isValid) {
    throw new Error("The script signature is invalid. Run `npm run sign` after changing PatreonScript.js.");
}

console.log(`Valid Grayjay script signature for plugin version ${config.version}.`);
