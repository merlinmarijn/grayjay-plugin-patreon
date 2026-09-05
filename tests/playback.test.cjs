const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function loadPlugin() {
  class Model { constructor(value) { Object.assign(this, value); } }
  const context = vm.createContext({
    bridge: { buildPlatform: 'desktop', buildVersion: 1 }, source: {}, log() {},
    http: { getDefaultClient(auth) { assert.equal(auth, true); return { clientId: 'synthetic-client' }; } },
    ContentPager: Model, VideoPager: Model, ChannelPager: Model, PlaylistPager: Model,
    CommentPager: Model, VideoSourceDescriptor: class { constructor(sources) { this.sources = sources; } },
    HLSSource: Model, VideoUrlSource: Model,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../PatreonScript.js'), 'utf8'), context);
  context.source.enable({}, {}, null);
  return context;
}

test('HLS and direct video sources request domain-scoped session authentication', () => {
  const context = loadPlugin();
  for (const extension of ['m3u8', 'mp4']) {
    const url = `https://www.patreon.com/media/file.${extension}?token=a%2Bb%3D`;
    const source = context.createVideoDescriptor({ url, duration: 42 }).sources[0];
    assert.equal(source.url, url);
    assert.equal(source.duration, 42);
    assert.equal(source.requestModifier.options.applyAuthClient, 'synthetic-client');
    assert.equal(source.requestModifier.options.applyOtherHeaders, true);
    assert.equal(source.requestModifier.headers.Referer, 'https://www.patreon.com/');
    assert.ok(source.requestModifier.headers['User-Agent']);
    assert.equal(source.requestModifier.headers.Cookie, undefined);
  }
});
