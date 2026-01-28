# steamcli-mafile-converter

Converts Steam `.maFile` files from Steam Desktop Authenticator format to a format that can be used with Steamguard CLI

## Usage

1. Put your `.maFile` files in `./to-convert/`.
2. Run: `node convert-mafiles.js`
3. Find converted files in `./converted/`.

### Manifest copy

By default, the script clones the Steamguard CLI `manifest.json` and writes an
updated copy to `./converted/manifest.json` with new account entries.

Update `MANIFEST_SOURCE` in `convert-mafiles.js` to point at your local steamguard-cli `manifest.json`.

To skip manifest generation:

```
node convert-mafiles.js --no-manifest
```
