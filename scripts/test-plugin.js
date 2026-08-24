import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginScript = await readFile(resolve(repositoryRoot, "PatreonScript.js"), "utf8");
const requests = [];
let manifestResponseForUrl = (url) => url.includes("/renditions/") ? {
    body: "#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:10\nhttps://c20.patreonusercontent.com/segment.ts",
    code: 200,
    isOk: true,
    url: "https://www.patreon.com/api/video/123/renditions/original.m3u8?u=1&expires=2&signature=signed",
} : ({
    body: `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1920x1080
/api/video/123/renditions/original.m3u8`,
    code: 200,
    isOk: true,
    url,
});

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
            return manifestResponseForUrl(url);
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

assert.equal(requests.length, 2);
assert.equal(requests[0].useAuthenticated, true);
assert.equal(requests[0].url, "https://www.patreon.com/api/video/123/manifest.m3u8");
assert.equal(requests[1].url, "https://www.patreon.com/api/video/123/renditions/original.m3u8");
assert.equal(
    hlsDescriptor.videoSources[0].url,
    "https://www.patreon.com/api/video/123/renditions/original.m3u8?u=1&expires=2&signature=signed"
);
assert.equal(hlsDescriptor.videoSources[0].duration, 42);
assert.ok(hlsDescriptor.videoSources[0] instanceof HLSSource);
assert.ok(hlsDescriptor.videoSources[0].requestModifier);

manifestResponseForUrl = (url) => url.includes("/renditions/") ? {
    body: "#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:10\nhttps://c20.patreonusercontent.com/segment.ts",
    code: 200,
    isOk: true,
    url: "https://www.patreon.com/api/video/123/renditions/original.m3u8?u=1&expires=2&signature=signed",
} : {
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

assert.equal(requests.length, 3, "Direct video files should not make a manifest request");
assert.equal(directDescriptor.videoSources[0].url, "https://cdn.example/video.mp4");

const nativeVideoDownload = vm.runInContext(`getNativeVideoDownload({
    relationships: { media: { data: [{ id: "video-media" }] } }
}, new Map([["media:video-media", {
    type: "media",
    id: "video-media",
    attributes: {
        download_url: "https://cdn.example/native-video.mp4?token=signed",
        mimetype: "video/mp4"
    }
}]]))`, context);

assert.equal(nativeVideoDownload.url, "https://cdn.example/native-video.mp4?token=signed");
assert.equal(nativeVideoDownload.container, "video/mp4");

console.log("Patreon media URL tests passed.");
