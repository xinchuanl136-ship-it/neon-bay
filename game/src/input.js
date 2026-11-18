// Keyboard state: a live set of pressed codes plus edge-triggered "just pressed".
export function createInput() {
  const down = new Set();
  const pressed = new Set();
  const input = {
    down,
    pressed,
    axisX() {
      let x = 0;
      if (down.has('KeyA') || down.has('ArrowLeft')) x -= 1;
      if (down.has('KeyD') || down.has('ArrowRight')) x += 1;
      return x;
    },
    axisY() {
      let y = 0;
      if (down.has('KeyW') || down.has('ArrowUp')) y -= 1;
      if (down.has('KeyS') || down.has('ArrowDown')) y += 1;
      return y;
    },
    // True only on the frame the key went down.
    hit(code) {
      return pressed.has(code);
    },
    endFrame() {
      pressed.clear();
    },
  };
  const onDown = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  };
  const onUp = (e) => down.delete(e.code);
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', () => down.clear());
  return input;
}
