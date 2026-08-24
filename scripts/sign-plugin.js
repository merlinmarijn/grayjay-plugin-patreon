import { generateKeyPairSync, createPublicKey, sign, verify } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(repositoryRoot, "PatreonConfig.json");
const scriptPath = resolve(repositoryRoot, "PatreonScript.js");
const privateKeyPath = process.env.GRAYJAY_SIGNING_KEY
    ? resolve(process.env.GRAYJAY_SIGNING_KEY)
    : resolve(repositoryRoot, ".grayjay-signing-key.pem");

async function loadOrCreatePrivateKey() {
    try {
        return await readFile(privateKeyPath, "utf8");
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    const { privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicExponent: 0x10001,
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
        publicKeyEncoding: { type: "spki", format: "pem" },
    });

    await writeFile(privateKeyPath, privateKey, { encoding: "utf8", mode: 0o600, flag: "wx" });
    console.log(`Created private signing key at ${privateKeyPath}`);
    console.log("Back up this file securely. Grayjay requires the same key for trusted updates.");
    return privateKey;
}

const privateKey = await loadOrCreatePrivateKey();
const script = await readFile(scriptPath);
const signature = sign("RSA-SHA512", script, privateKey).toString("base64");
const publicKey = createPublicKey(privateKey)
    .export({ type: "spki", format: "der" })
    .toString("base64");

if (!verify("RSA-SHA512", script, createPublicKey(privateKey), Buffer.from(signature, "base64"))) {
    throw new Error("Generated signature could not be verified.");
}

const configText = (await readFile(configPath, "utf8")).replace(/\r\n/g, "\n");
const config = JSON.parse(configText);
const signedConfig = configText
    .replace(/("scriptSignature"\s*:\s*)"[^"]*"/, `$1"${signature}"`)
    .replace(/("scriptPublicKey"\s*:\s*)"[^"]*"/, `$1"${publicKey}"`);

if (signedConfig === configText && (!config.scriptSignature || !config.scriptPublicKey)) {
    throw new Error("Could not find scriptSignature and scriptPublicKey in PatreonConfig.json.");
}

await writeFile(configPath, signedConfig, "utf8");

console.log(`Signed PatreonScript.js and updated PatreonConfig.json (version ${config.version}).`);
