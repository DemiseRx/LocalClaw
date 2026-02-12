module.exports = {
  run: [
    {
      method: "shell.run",
      params: {
        message: "node scripts/smoke-test-local.mjs"
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
