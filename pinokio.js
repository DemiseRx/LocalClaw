module.exports = {
  version: "5.0",
  menu: async () => {
    return [{
      icon: "fa-solid fa-plug",
      text: "Install",
      href: "install.json",
    }, {
      icon: "fa-solid fa-circle-play",
      text: "Start (Auto detect Ollama/LM Studio)",
      href: "start.js",
    }, {
      icon: "fa-solid fa-vial",
      text: "Local API smoke test",
      href: "test.js",
    }, {
      icon: "fa-solid fa-arrows-rotate",
      text: "Update",
      href: "update.js",
    }, {
      icon: "fa-regular fa-trash-can",
      text: "Uninstall",
      href: "uninstall.js",
    }]
  }
}
