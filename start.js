module.exports = {
  daemon: true,
  run: [
    {
      method: "shell.run",
      params: {
        message: [
          "bash scripts/start_localclaw.sh"
        ],
        on: [{
          event: "/listening on.*ws:\\/\\/([0-9.:]+)/",
          done: true
        }]
      }
    },
    {
      method: "shell.run",
      params: {
        message: [
          "export OPENCLAW_CONFIG_PATH=$PWD/.localclaw/openclaw.local.json",
          "openclaw dashboard"
        ],
        on: [{
          event: "/http:\\/\\/[^ ]+ /",
          done: true
        }]
      }
    }
  ]
}
