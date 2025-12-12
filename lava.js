const title = document.getElementById("lavaTitle");

if (title) {
  let mouseX = 0;
  let mouseY = 0;
  let currentX = 0;
  let currentY = 0;

  document.addEventListener("mousemove", (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 20;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 20;
  });

  function animate() {
    currentX += (mouseX - currentX) * 0.05;
    currentY += (mouseY - currentY) * 0.05;

    title.style.transform = `
      translate(${currentX}px, ${currentY}px)
      scale(1)
    `;

    requestAnimationFrame(animate);
  }

  animate();
}

