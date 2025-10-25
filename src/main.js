const http = require("http");
const fs = require("fs");
const path = require("path");

const PUBLIC = path.join(__dirname, "../public");

http
  .createServer((req, res) => {
    let safePath = path
      .normalize(decodeURIComponent(req.url))
      .replace(/^(\.\.[\/\\])+/, "");
    let filePath = path.join(
      PUBLIC,
      safePath === "/" ? "/index.html" : safePath,
    );

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "text/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
      };
      const contentType = mimeTypes[ext] || "application/octet-stream";

      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
    });
  })
  .listen(80);
