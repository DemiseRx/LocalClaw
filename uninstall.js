module.exports = {
  run: [
    {
      method: "shell.run",
      params: {
        message: "openclaw uninstall --all --yes || true"
      }
    },
    {
      method: "shell.run",
      params: {
        message: "npm uninstall -g openclaw || true"
      }
    },
    {
      method: "shell.run",
      params: {
        message: "rm -rf .localclaw"
      }
    }
  ]
}
