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
        message: "npm i -g openclaw@latest"
      }
    },
    {
      method: "shell.run",
      params: {
        message: "python3 scripts/render_local_config.py"
      }
    }
  ]
}
