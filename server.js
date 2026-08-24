import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { readFile } from "node:fs/promises";

const PORT = 8080;

const files = {
    "/PatreonScript.js": {
        path: "PatreonScript.js",
        type: "application/javascript",
    },
    "/patreon_logo.png": {
        path: "patreon_logo.png",
        type: "image/png",
    },
};

function getLocalIPAddresses() {
    return Object.values(networkInterfaces())
        .flatMap((networkInterface) => networkInterface ?? [])
        .filter(({ family, internal }) => family === "IPv4" && !internal)
        .map(({ address }) => address);
}

createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `localhost:${PORT}`}`);
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
    };

    try {
        if (requestUrl.pathname === "/PatreonConfig.json") {
            const config = JSON.parse(await readFile("PatreonConfig.json", "utf8"));

            // During local development, Grayjay must fetch the script and icon
            // from this server instead of the production sourceUrl in the file.
            config.sourceUrl = `http://${req.headers.host ?? `localhost:${PORT}`}/PatreonConfig.json`;

            res.writeHead(200, { ...headers, "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify(config, null, "\t"));
            return;
        }

        // Keep the old icon route working for anyone who bookmarked it.
        const pathname = requestUrl.pathname === "/PatreonIcon.png"
            ? "/patreon_logo.png"
            : requestUrl.pathname;
        const file = files[pathname];

        if (file !== undefined) {
            res.writeHead(200, { ...headers, "Content-Type": file.type });
            res.end(await readFile(file.path));
            return;
        }
    } catch (error) {
        res.writeHead(500, { ...headers, "Content-Type": "text/plain; charset=utf-8" });
        res.end(`Failed to serve plugin file: ${error.message}`);
        return;
    }

    res.writeHead(404, { ...headers, "Content-Type": "text/plain; charset=utf-8" });
    res.end("File not found");
}).listen(PORT, "0.0.0.0", () => {
    console.log("Grayjay development install URLs:");
    console.log(`  http://localhost:${PORT}/PatreonConfig.json`);
    for (const address of getLocalIPAddresses()) {
        console.log(`  http://${address}:${PORT}/PatreonConfig.json`);
    }
});
