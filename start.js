module.exports = {
  daemon: true,
  run: [
    {
      method: "shell.run",
      params: {
        message: ["node scripts/start-localclaw.mjs"],
        on: [{ event: "/listening on.*ws:\\/\\/([0-9.:]+)/", done: true }]
      }
    },
    {
      method: "shell.run",
      params: {
        message: ["node scripts/open-dashboard.mjs"],
        on: [{ event: "/http:\\/\\/[^ ]+ /", done: true }]
      }
    }
  ]
}
