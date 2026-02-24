module.exports = {
  run: [
    {
      method: "shell.run",
      params: {
        message: "git pull"
      }
    },
    {
      method: "shell.run",
      params: {
        message: "node scripts/install-openclaw.mjs"
      }
    },
    {
      method: "shell.run",
      params: {
        message: "node scripts/install-skill-prereqs.mjs"
      }
    },
    {
      method: "shell.run",
      params: {
        message: "node scripts/patch-openclaw-config.mjs"
      }
    }
  ]
}
