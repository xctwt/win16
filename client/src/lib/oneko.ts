export function initOneko() {
  const nekoEl = document.createElement('div');
  nekoEl.style.width = '32px';
  nekoEl.style.height = '32px';
  nekoEl.style.position = 'fixed';
  nekoEl.style.backgroundImage = 'url("https://adryd.com/oneko/oneko.gif")';
  nekoEl.style.imageRendering = 'pixelated';
  nekoEl.style.pointerEvents = 'none';
  nekoEl.style.zIndex = '999';

  document.body.appendChild(nekoEl);

  let frameCount = 0;
  let idleAnimation = null;
  let idleAnimationFrame = 0;
  const nekoSpeed = 10;
  let nekoPosX = 32;
  let nekoPosY = 32;
  let mousePosX = 0;
  let mousePosY = 0;

  document.addEventListener('mousemove', (e) => {
    mousePosX = e.clientX;
    mousePosY = e.clientY;
  });

  function frame() {
    const diffX = mousePosX - nekoPosX;
    const diffY = mousePosY - nekoPosY;
    const distance = Math.sqrt(diffX ** 2 + diffY ** 2);

    if (distance < nekoSpeed) {
      idleAnimation = idleAnimation || setInterval(() => {
        idleAnimationFrame = (idleAnimationFrame + 1) % 4;
        nekoEl.style.backgroundPosition = `-${idleAnimationFrame * 32}px -${0 * 32}px`;
      }, 200);
    } else {
      if (idleAnimation) {
        clearInterval(idleAnimation);
        idleAnimation = null;
      }

      nekoPosX += (diffX / distance) * nekoSpeed;
      nekoPosY += (diffY / distance) * nekoSpeed;
      frameCount = (frameCount + 1) % 4;

      let direction = Math.round(Math.atan2(diffY, diffX) / (Math.PI / 4));
      direction = (direction + 8) % 8;
      nekoEl.style.backgroundPosition = `-${frameCount * 32}px -${direction * 32}px`;
    }

    nekoEl.style.left = `${nekoPosX - 16}px`;
    nekoEl.style.top = `${nekoPosY - 16}px`;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
