#!/usr/bin/env node
const fs = require("fs/promises");
const path = require("path");

const ROOT_DIR = process.cwd();
const INPUT_DIR = path.join(ROOT_DIR, "to-convert");
const OUTPUT_DIR = path.join(ROOT_DIR, "converted");

const dropSteamIdPrefix = (steamId64) => {
  if (!steamId64) return null;
  const steamIdStr = String(steamId64);
  if (steamIdStr.startsWith("765611")) {
    return Number(steamIdStr.slice(6));
  }
  return Number(steamIdStr);
};

const getSteamId64FromFilename = (filename) => {
  const name = path.basename(filename, ".maFile");
  if (!name) return null;
  return name;
};

const buildOutput = (input, filename) => {
  const steamId64 =
    input?.Session?.SteamID ??
    input?.steam_id ??
    input?.steamId ??
    getSteamId64FromFilename(filename);
  const steamId = dropSteamIdPrefix(steamId64);

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
    steam_id: Number.isFinite(steamId) ? steamId : null,
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

const main = async () => {
  await fs.mkdir(INPUT_DIR, { recursive: true });
  const entries = await fs.readdir(INPUT_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".maFile"))
    .map((entry) => entry.name);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const filename of files) {
    const inputPath = path.join(INPUT_DIR, filename);
    const outputPath = path.join(OUTPUT_DIR, filename);
    const raw = await fs.readFile(inputPath, "utf8");
    const data = JSON.parse(raw);
    const output = buildOutput(data, filename);
    await fs.writeFile(outputPath, JSON.stringify(output), "utf8");
  }

  console.log(`Converted ${files.length} file(s).`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
