import http from "http";
import { loadProjectEnv } from "./loadEnv.mjs";
import { createImgbbUploadMiddleware } from "./imgbbUploadHandler.mjs";

loadProjectEnv();

const port = Number(process.env.SERVER_PORT || 8787);
const imgbbMiddleware = createImgbbUploadMiddleware();

const server = http.createServer((req, res) => {
  imgbbMiddleware(req, res, () => {
    if (req.url?.startsWith("/api/")) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ success: false, error: "NOT_FOUND" }));
      return;
    }
    res.statusCode = 404;
    res.end("Not Found");
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[imgbb-proxy] http://127.0.0.1:${port}/api/imgbb/upload`);
});
