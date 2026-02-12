module.exports = {
  run: [
    {
      method: "shell.run",
      params: {
        message: "bash scripts/smoke_test_local.sh"
      }
    },
    {
      method: "modal",
      params: {
        title: "Smoke test passed",
        description: "OpenClaw successfully called the mock local OpenAI API endpoint and received the expected test phrase."
      }
    }
  ]
}
