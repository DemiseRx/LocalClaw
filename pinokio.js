module.exports = {
  version: "5.0",
  menu: async (kernel, info) => {
    return [{
      icon: "fa-solid fa-plug",
      text: "Install (Quick Start baseline)",
      href: "install.quickstart.json",
    }, {
      icon: "fa-solid fa-house-signal",
      text: "Install (Quick Start + Local Model)",
      href: "install.json",
    }, {
      icon: "fa-solid fa-wrench",
      text: "Enable/refresh local model config",
      href: "local-model.json",
    }, {
      icon: "fa-solid fa-circle-play",
      text: "Start",
      href: "start.js",
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
