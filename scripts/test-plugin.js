import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginScript = await readFile(resolve(repositoryRoot, "PatreonScript.js"), "utf8");
const requests = [];

class VideoSourceDescriptor {
    constructor(videoSources) {
        this.videoSources = videoSources;
    }
}

class HLSSource {
    constructor(definition) {
        Object.assign(this, definition);
    }
}

class VideoUrlSource {
    constructor(definition) {
        Object.assign(this, definition);
    }
}

class Pager {
    constructor(results = [], hasMore = false) {
        this.results = results;
        this.hasMore = hasMore;
    }
}

const context = vm.createContext({
    bridge: {
        buildPlatform: "desktop",
        buildVersion: 999,
        authUserAgent: "Grayjay Patreon plugin test",
        captchaUserAgent: null,
    },
    source: {},
    http: {
        GET(url, headers, useAuthenticated) {
            requests.push({ url, headers, useAuthenticated });
            return {
                body: "#EXTM3U",
                code: 200,
                isOk: true,
                url: "https://stream.mux.com/playback-id.m3u8?token=signed",
            };
        },
    },
    VideoSourceDescriptor,
    HLSSource,
    VideoUrlSource,
    ChannelPager: Pager,
    ContentPager: Pager,
    VideoPager: Pager,
    CommentPager: Pager,
    log() {},
    console,
});

vm.runInContext(pluginScript, context, { filename: "PatreonScript.js" });
vm.runInContext("source.enable({}, {}, null)", context);

const hlsDescriptor = vm.runInContext(`createVideoDescriptor({
    url: "https://www.patreon.com/api/video/123/manifest.m3u8",
    duration: 42
})`, context);

assert.equal(requests.length, 1);
assert.equal(requests[0].useAuthenticated, true);
assert.equal(requests[0].url, "https://www.patreon.com/api/video/123/manifest.m3u8");
assert.equal(hlsDescriptor.videoSources[0].url, "https://stream.mux.com/playback-id.m3u8?token=signed");
assert.equal(hlsDescriptor.videoSources[0].duration, 42);
assert.ok(hlsDescriptor.videoSources[0].requestModifier);

const directDescriptor = vm.runInContext(`createVideoDescriptor({
    url: "https://cdn.example/video.mp4",
    duration: 21
})`, context);

assert.equal(requests.length, 1, "Direct video files should not make a manifest request");
assert.equal(directDescriptor.videoSources[0].url, "https://cdn.example/video.mp4");

console.log("Patreon media URL tests passed.");
