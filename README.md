# Chatto Rocket 🚀

Videojuego 2D inspirado en Flappy Bird desarrollado en **HTML5 Canvas, CSS3 y JavaScript puro**, utilizando exclusivamente los assets originales del proyecto.

## 🎮 Assets Originales Utilizados

1. **`assets/Chatto sin llamas.png`**: Estado normal, caída y pantalla de inicio.
2. **`assets/Chatto con llamas.png`**: Estado de propulsión e impulso activo (160 ms).
3. **`assets/Obstaculo.png`**:
   - **Inferior**: Orientación original, alineado con el fondo del juego.
   - **Superior**: Mismo asset volteado verticalmente usando `ctx.scale(1, -1)`.
4. **`assets/Fondo.png`**: Fondo visual único y auténtico, ajustado proporcionalmente detrás de todos los elementos en inicio, juego y fin de partida.

---

## 🕹️ Controles

- **Barra espaciadora (Espacio):** Activa el impulso del cohete hacia arriba.
- **Clic izquierdo del mouse:** Activa el impulso del cohete hacia arriba.
- **Toque en pantalla táctil:** Activa el impulso en dispositivos móviles.

Cualquiera de estas tres acciones inicia la partida inmediatamente con el primer impulso y permite reiniciar tras una derrota (con cooldown de seguridad contra reinicios accidentales).

---

## 🚀 Cómo ejecutar el juego

### Opción 1: Abrir directamente en el navegador

  👉 [https://alexis0444.github.io/ChattoGame/]


