module.exports = {
  apps: [
    {
      name: "nesbox",
      cwd: __dirname,
      script: "scripts/serve.cjs",
      interpreter: "node",
      watch: false,
    },
  ],
};
