const path = require("node:path");

process.loadEnvFile(path.join(__dirname, "..", ".env"));
process.env.NODE_ENV = process.env.NODE_ENV ?? "production";

process.argv = [
  process.argv[0],
  path.join(__dirname, "..", "node_modules", "@react-router", "serve", "bin.js"),
  path.join(__dirname, "..", "build", "server", "index.js"),
];

require("../node_modules/@react-router/serve/bin.js");
