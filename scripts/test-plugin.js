import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginScript = await readFile(resolve(repositoryRoot, "PatreonScript.js"), "utf8");
const requests = [];
let manifestResponse = {
    body: `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1920x1080
https://stream.mux.com/playback-id.m3u8?token=signed`,
    code: 200,
    isOk: true,
    url: "https://www.patreon.com/api/video/123/manifest.m3u8",
};

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
            return manifestResponse;
        },
    },
    VideoSourceDescriptor,
    HLSSource,
    VideoUrlSource,
    ChannelPager: Pager,
    ContentPager: Pager,
    VideoPager: Pager,
    CommentPager: Pager,
    URL,
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

manifestResponse = {
    body: "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\nvariants/720p.m3u8?token=relative",
    code: 200,
    isOk: true,
    url: "https://cdn.example/manifests/master.m3u8",
};

const relativeHlsDescriptor = vm.runInContext(`createVideoDescriptor({
    url: "https://www.patreon.com/api/video/456/manifest.m3u8",
    duration: 84
})`, context);

assert.equal(
    relativeHlsDescriptor.videoSources[0].url,
    "https://cdn.example/manifests/variants/720p.m3u8?token=relative"
);

const directDescriptor = vm.runInContext(`createVideoDescriptor({
    url: "https://cdn.example/video.mp4",
    duration: 21
})`, context);

assert.equal(requests.length, 2, "Direct video files should not make a manifest request");
assert.equal(directDescriptor.videoSources[0].url, "https://cdn.example/video.mp4");

console.log("Patreon media URL tests passed.");
