import http from "http";
import { loadProjectEnv } from "./loadEnv.mjs";
import { ROUTES } from "./imageUpload/constants.mjs";
import { createImageUploadMiddleware } from "./imageUpload/createImageUploadMiddleware.mjs";

loadProjectEnv();

const port = Number(process.env.SERVER_PORT || 8787);
const host = String(process.env.SERVER_HOST || "127.0.0.1").trim() || "127.0.0.1";
const uploadMiddleware = createImageUploadMiddleware();

const server = http.createServer((req, res) => {
  uploadMiddleware(req, res, () => {
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

server.listen(port, host, () => {
  console.log(`[image-upload-api] http://${host}:${port}${ROUTES.UPLOAD}`);
  console.log(`[image-upload-api] health  http://${host}:${port}${ROUTES.HEALTH}`);
  console.log(`[image-upload-api] legacy  http://${host}:${port}/api/imgbb/upload`);
});
