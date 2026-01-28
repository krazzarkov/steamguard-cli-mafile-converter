#!/usr/bin/env node
const fs = require("fs/promises");
const path = require("path");

const ROOT_DIR = process.cwd();
const INPUT_DIR = path.join(ROOT_DIR, "to-convert");
const OUTPUT_DIR = path.join(ROOT_DIR, "converted");
const MANIFEST_SOURCE =
  "path-to-your/steamguard-cli/maFiles/manifest.json";
const MANIFEST_OUTPUT = path.join(OUTPUT_DIR, "manifest.json");
const GENERATE_MANIFEST =
  !process.argv.includes("--no-manifest") &&
  !process.argv.includes("no-manifest");

const getSteamId64FromFilename = (filename) => {
  const name = path.basename(filename, ".maFile");
  if (!name) return null;
  return name;
};

const buildOutput = (input, filename) => {
  const steamId64FromFilename = getSteamId64FromFilename(filename);
  const steamId64 =
    steamId64FromFilename ??
    input?.Session?.SteamID ??
    input?.steam_id ??
    input?.steamId ??
    null;
  const steamId = steamId64 ? String(steamId64) : null;

  const accessToken =
    input?.Session?.AccessToken ??
    input?.tokens?.access_token ??
    input?.access_token ??
    null;
  const refreshToken =
    input?.Session?.RefreshToken ??
    input?.tokens?.refresh_token ??
    input?.refresh_token ??
    null;

  const output = {
    account_name: input?.account_name ?? input?.accountName ?? "",
    steam_id: steamId ?? null,
    serial_number: input?.serial_number ?? input?.serialNumber ?? "",
    revocation_code: input?.revocation_code ?? input?.revocationCode ?? "",
    shared_secret: input?.shared_secret ?? input?.sharedSecret ?? "",
    token_gid: input?.token_gid ?? input?.tokenGid ?? input?.tokenGID ?? "",
    identity_secret: input?.identity_secret ?? input?.identitySecret ?? "",
    uri: input?.uri ?? "",
    device_id: input?.device_id ?? input?.deviceId ?? "",
    secret_1: input?.secret_1 ?? input?.secret1 ?? "",
  };

  if (accessToken || refreshToken) {
    output.tokens = {};
    if (accessToken) {
      output.tokens.access_token = accessToken;
    }
    if (refreshToken) {
      output.tokens.refresh_token = refreshToken;
    }
  }

  return output;
};

const getManifestEntry = (input, filename) => {
  const steamId64FromFilename = getSteamId64FromFilename(filename);
  const steamId64 =
    steamId64FromFilename ??
    input?.Session?.SteamID ??
    input?.steam_id ??
    input?.steamId ??
    null;
  return {
    filename,
    steam_id: steamId64 ? String(steamId64) : null,
    account_name: input?.account_name ?? input?.accountName ?? "",
    encryption: null,
  };
};

const isDigits = (value) => typeof value === "string" && /^\d+$/.test(value);

const toNumberIfDigits = (value) => (isDigits(value) ? Number(value) : null);

const serializeManifest = (manifest, entries) => {
  const version = Number.isFinite(manifest?.version) ? manifest.version : 1;
  const normalizedEntries = entries.filter((entry) => isDigits(entry?.steam_id));
  const entryJson = normalizedEntries.map((entry) => {
    const parts = [
      `"filename":${JSON.stringify(entry?.filename ?? "")}`,
      `"steam_id":${entry.steam_id}`,
      `"account_name":${JSON.stringify(entry?.account_name ?? "")}`,
      `"encryption":${JSON.stringify(entry?.encryption ?? null)}`,
    ];
    return `{${parts.join(",")}}`;
  });

  return `{"version":${version},"entries":[${entryJson.join(",")}]}`;
};

const serializeMaFile = (output) => {
  const steamId = output?.steam_id;
  const parts = [
    `"account_name":${JSON.stringify(output?.account_name ?? "")}`,
    `"steam_id":${isDigits(steamId) ? steamId : "null"}`,
    `"serial_number":${JSON.stringify(output?.serial_number ?? "")}`,
    `"revocation_code":${JSON.stringify(output?.revocation_code ?? "")}`,
    `"shared_secret":${JSON.stringify(output?.shared_secret ?? "")}`,
    `"token_gid":${JSON.stringify(output?.token_gid ?? "")}`,
    `"identity_secret":${JSON.stringify(output?.identity_secret ?? "")}`,
    `"uri":${JSON.stringify(output?.uri ?? "")}`,
    `"device_id":${JSON.stringify(output?.device_id ?? "")}`,
    `"secret_1":${JSON.stringify(output?.secret_1 ?? "")}`,
  ];

  if (output?.tokens) {
    const tokenParts = [];
    if (output.tokens.access_token) {
      tokenParts.push(
        `"access_token":${JSON.stringify(output.tokens.access_token)}`
      );
    }
    if (output.tokens.refresh_token) {
      tokenParts.push(
        `"refresh_token":${JSON.stringify(output.tokens.refresh_token)}`
      );
    }
    parts.push(`"tokens":{${tokenParts.join(",")}}`);
  }

  return `{${parts.join(",")}}`;
};

const main = async () => {
  await fs.mkdir(INPUT_DIR, { recursive: true });
  const entries = await fs.readdir(INPUT_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".maFile"))
    .map((entry) => entry.name);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const newManifestEntries = [];

  for (const filename of files) {
    const inputPath = path.join(INPUT_DIR, filename);
    const outputPath = path.join(OUTPUT_DIR, filename);
    const raw = await fs.readFile(inputPath, "utf8");
    const data = JSON.parse(raw);
    const output = buildOutput(data, filename);
    newManifestEntries.push(getManifestEntry(data, filename));
    await fs.writeFile(outputPath, serializeMaFile(output), "utf8");
  }

  if (GENERATE_MANIFEST) {
    const manifestRaw = await fs.readFile(MANIFEST_SOURCE, "utf8");
    const manifest = JSON.parse(manifestRaw);
    const existingEntries = Array.isArray(manifest.entries)
      ? manifest.entries.map((entry) => {
          const entryFilename = entry?.filename;
          const steamId64FromFilename =
            typeof entryFilename === "string"
              ? getSteamId64FromFilename(entryFilename)
              : null;
          return {
            ...entry,
            steam_id: steamId64FromFilename
              ? String(steamId64FromFilename)
              : entry?.steam_id != null
                ? String(entry.steam_id)
                : null,
          };
        })
      : [];
    const existingSteamIds = new Set(
      existingEntries.map((entry) => String(entry?.steam_id)).filter((id) => id)
    );

    const mergedEntries = [
      ...existingEntries,
      ...newManifestEntries.filter(
        (entry) =>
          entry?.steam_id &&
          !existingSteamIds.has(String(entry.steam_id))
      ),
    ];

    const manifestCopy = serializeManifest(manifest, mergedEntries);
    await fs.writeFile(MANIFEST_OUTPUT, manifestCopy, "utf8");
  }

  console.log(
    GENERATE_MANIFEST
      ? `Converted ${files.length} file(s) and wrote manifest copy.`
      : `Converted ${files.length} file(s).`
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
