# Patreon - Custom

A custom Grayjay Patreon source based on FUTO's official Patreon plugin.

## Install from GitHub

In Grayjay, open **Sources**, choose **Add source**, then **Enter URL** and paste:

```text
https://raw.githubusercontent.com/merlinmarijn/grayjay-plugin-patreon/master/PatreonConfig.json
```

The custom source has its own UUID, so it can be installed alongside the official
Patreon source. It is signed with this fork's own key so Grayjay can verify future
updates.

The public URL follows the `master` branch. Push changes to that branch and
increment `version` in `PatreonConfig.json` whenever you publish an update. After
changing `PatreonScript.js`, refresh the signature before committing:

```shell
npm run sign
npm run check
```

The first signing run creates `.grayjay-signing-key.pem`, which Git ignores. Back
up that private key securely: losing it means future updates cannot be verified as
coming from the same author. You can instead set `GRAYJAY_SIGNING_KEY` to use a
private key stored outside the repository.

## Develop locally

Requires Node.js 18 or newer.

```shell
npm start
```

The server prints install URLs for localhost and every local IPv4 address. Use an
address reachable from the device running Grayjay. It reloads the config, script,
and icon from disk on every request, so restart the server only when changing
`server.js` itself.

The development server temporarily rewrites `sourceUrl` in its response so that
Grayjay loads the local script and icon. It does not modify the production config
on disk.

## Upstream

The source was originally copied from FUTO's official plugin:
https://gitlab.futo.org/videostreaming/plugins/patreon
