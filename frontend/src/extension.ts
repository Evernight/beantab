import { renderApp } from "./app";

export default {
  onExtensionPageLoad() {
    const container = document.getElementById("beantabApp");
    renderApp(container!);
  },
};
