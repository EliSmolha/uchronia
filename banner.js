const hero = document.querySelector(".hero");
const title = document.getElementById("heroTitle");
const submit = document.getElementById("heroSubmit");

if (hero && title && submit) {
  let toggled = false;

  hero.addEventListener("click", () => {
    if (window.innerWidth > 768) return;

    toggled = !toggled;
    title.style.opacity = toggled ? "0" : "1";
    submit.style.opacity = toggled ? "1" : "0";
  });
}
