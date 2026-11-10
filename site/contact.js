// Az e-mail-cím nem szerepel a HTML-ben; csak kattintásra áll össze, hogy a begyűjtő robotok ne lássák.
document.querySelectorAll("[data-contact]").forEach(el => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "reveal";
  button.textContent = el.dataset.label;
  button.addEventListener("click", () => {
    const user = ["my", "new", "page"].join("");
    const host = ["as", "hu"].join(String.fromCharCode(46));
    const address = user + String.fromCharCode(64) + host;
    const link = document.createElement("a");
    link.href = "mailto:" + address;
    link.textContent = address;
    button.replaceWith(link);
  });
  el.replaceChildren(button);
});
