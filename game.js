(() => {
  'use strict';

  // Canvas y contexto
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');

  // Resolución lógica interna (coherente con relación de aspecto móvil 9:16)
  const GAME_WIDTH = 480;
  const GAME_HEIGHT = 720;
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;

  // Estados del juego
  const STATE = {
    LOADING: 'loading',
    START: 'start',
    PLAYING: 'playing',
    GAMEOVER: 'gameover'
  };
  let currentState = STATE.LOADING;

  // Assets requeridos (rutas exactas originales)
  const ASSET_SOURCES = {
    bg: 'assets/Fondo.png',
    chattoNoFlames: 'assets/Chatto sin llamas.png',
    chattoFlames: 'assets/Chatto con llamas.png',
    obstacle: 'assets/Obstaculo.png'
  };

  const images = {};
  let loadedCount = 0;
  const totalAssets = Object.keys(ASSET_SOURCES).length;

  // Variables de puntuación y Top Récords
  let score = 0;
  let highScore = parseInt(localStorage.getItem('chatto_rocket_high_score') || '0', 10);
  if (isNaN(highScore)) highScore = 0;

  // Cargar lista de mejores puntajes
  function getLeaderboard() {
    try {
      const stored = localStorage.getItem('chatto_rocket_leaderboard');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    // Valores predeterminados si aún no hay partidas guardadas
    return [
      { name: 'Chatto Pro', score: 15 },
      { name: 'Rocket Ace', score: 10 },
      { name: 'Star Flyer', score: 6 },
      { name: 'Cosmo Bot', score: 3 },
      { name: 'Explorer', score: 1 }
    ];
  }

  function saveLeaderboard(board) {
    try {
      localStorage.setItem('chatto_rocket_leaderboard', JSON.stringify(board));
    } catch (_) {}
  }

  // Verifica si un puntaje califica para el Top 5
  function qualifiesForTop(newScore) {
    if (newScore <= 0) return false;
    const board = getLeaderboard();
    if (board.length < 5) return true;
    return newScore > board[board.length - 1].score;
  }

  let pendingScore = 0;
  let isEnteringRecord = false;

  function promptTopRecord(newScore) {
    const modal = document.getElementById('record-modal');
    const modalScore = document.getElementById('modal-score');
    const nameInput = document.getElementById('player-name-input');
    if (!modal || !nameInput) return;

    pendingScore = newScore;
    isEnteringRecord = true;
    if (modalScore) modalScore.textContent = newScore.toString();
    nameInput.value = localStorage.getItem('chatto_rocket_last_player_name') || '';
    modal.classList.add('active');
    setTimeout(() => nameInput.focus(), 150);
  }

  function registerScoreWithName(playerName, finalScore) {
    const trimmed = playerName.trim() || 'Jugador';
    localStorage.setItem('chatto_rocket_last_player_name', trimmed);

    const board = getLeaderboard();
    board.push({ name: trimmed, score: finalScore });
    board.sort((a, b) => b.score - a.score);
    const top5 = board.slice(0, 5);
    saveLeaderboard(top5);
    renderLeaderboardUI();
  }

  function renderLeaderboardUI() {
    const listEl = document.getElementById('leaderboard-list');
    const bestDisplay = document.getElementById('best-score-display');
    if (bestDisplay) bestDisplay.textContent = highScore.toString();
    if (!listEl) return;

    const board = getLeaderboard();
    listEl.innerHTML = '';

    board.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = `leaderboard-item rank-${index + 1}`;

      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
      li.innerHTML = `
        <div class="leaderboard-rank">
          <span class="rank-badge">${medal}</span>
          <span class="player-name">${escapeHtml(item.name)}</span>
        </div>
        <span class="leaderboard-pts">${item.score} <small style="font-size:0.7rem; color:#94a3b8;">pts</small></span>
      `;
      listEl.appendChild(li);
    });
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  // Listener del formulario de récord
  const recordForm = document.getElementById('record-form');
  if (recordForm) {
    recordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('player-name-input');
      const modal = document.getElementById('record-modal');
      const enteredName = nameInput ? nameInput.value : 'Jugador';
      registerScoreWithName(enteredName, pendingScore);
      if (modal) modal.classList.remove('active');
      isEnteringRecord = false;
      gameOverTime = performance.now(); // reset cooldown tras guardar
    });
  }

  // Temporizadores y control de entrada
  let lastTime = performance.now();
  let gameOverTime = 0; // Para evitar reinicio instantáneo accidental
  const RESTART_COOLDOWN_MS = 500; // 0.5s de gracia tras chocar

  // Audio sintético opcional mediante Web Audio API (para feedback premium sin archivos externos)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    try {
      const actx = getAudioContext();
      if (!actx) return;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.connect(gain);
      gain.connect(actx.destination);
      const now = actx.currentTime;

      if (type === 'jump') {
        // Sonido de propulsión de cohete
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(380, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'score') {
        // Sonido de punto conseguido
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.setValueAtTime(780, now + 0.08);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'hit') {
        // Sonido de colisión
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.25);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.26);
        osc.start(now);
        osc.stop(now + 0.26);
      }
    } catch (_) {
      // Ignorar restricciones de audio del navegador
    }
  }

  // --- PERSONAJE CHATTO ---
  const chatto = {
    // Posición horizontal en el ~25% de la pantalla (480 * 0.25 = 120)
    x: 120,
    y: 320,
    baseY: 320,
    width: 68,
    height: 68,
    vy: 0,
    gravity: 1200,      // px/s^2
    jumpStrength: -400, // impulso hacia arriba
    flameTimer: 0,      // tiempo restante con llamas (segundos)
    flameDuration: 0.16,// 160 ms (rango 120-200 ms especificado)
    bobbingAngle: 0,    // para animación suave en pantalla de inicio

    reset() {
      this.x = 120;
      this.y = 320;
      this.vy = 0;
      this.flameTimer = 0;
      this.bobbingAngle = 0;
    },

    jump() {
      this.vy = this.jumpStrength;
      this.flameTimer = this.flameDuration;
      playSound('jump');
    },

    update(dt) {
      if (currentState === STATE.START) {
        // Flotación suave tipo espera
        this.bobbingAngle += dt * 3.5;
        this.y = this.baseY + Math.sin(this.bobbingAngle) * 12;
        this.vy = 0;
        this.flameTimer = 0;
        return;
      }

      if (currentState === STATE.PLAYING) {
        // Física activa
        this.vy += this.gravity * dt;
        this.y += this.vy * dt;

        // Contador de llamas
        if (this.flameTimer > 0) {
          this.flameTimer -= dt;
          if (this.flameTimer < 0) this.flameTimer = 0;
        }

        // Límite superior: detener o limitar para no salir
        if (this.y < 0) {
          this.y = 0;
          if (this.vy < 0) this.vy = 0;
        }

        // Caída por el límite inferior
        if (this.y + this.height * 0.75 >= GAME_HEIGHT) {
          triggerGameOver();
        }
      }
    },

    draw() {
      // Usar Chatto con llamas durante impulso (flameTimer > 0), sino Chatto sin llamas
      const currentImg = (this.flameTimer > 0) ? images.chattoFlames : images.chattoNoFlames;
      if (!currentImg) return;

      ctx.save();
      // Leve rotación según la velocidad vertical para mayor fluidez visual
      let rotation = 0;
      if (currentState === STATE.PLAYING) {
        rotation = Math.max(-0.35, Math.min(0.5, (this.vy / 650)));
      }

      ctx.translate(this.x, this.y);
      ctx.rotate(rotation);
      // Dibujar centrado en (x, y)
      ctx.drawImage(
        currentImg,
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      );
      ctx.restore();
    },

    // Caja de colisión ajustada (evita bordes transparentes)
    getCollisionBox() {
      const radius = 18; // Radio circular ajustado estrictamente al cuerpo de Chatto
      return {
        cx: this.x,
        cy: this.y,
        r: radius
      };
    }
  };

  // --- OBSTÁCULOS ---
  const OBSTACLE_WIDTH = 180;   // Ancho sustancialmente más robusto
  const GAP_HEIGHT = 185;       // Espacio vertical para cruzar cómodamente
  const PIPE_SPACING = 320;     // Distancia horizontal entre columnas
  const BASE_SPEED = 160;       // px/s
  let obstacles = [];
  let obstacleTimer = 0;
  let currentSpeed = BASE_SPEED;

  class ObstaclePair {
    constructor(x) {
      this.x = x;
      this.width = OBSTACLE_WIDTH;
      // Altura del centro del hueco: entre 140 y 480
      const minCenter = 150;
      const maxCenter = GAME_HEIGHT - 170;
      this.gapCenterY = Math.floor(minCenter + Math.random() * (maxCenter - minCenter));
      this.gapHeight = GAP_HEIGHT;
      this.passed = false;
    }

    get topHeight() {
      return this.gapCenterY - this.gapHeight / 2;
    }

    get bottomY() {
      return this.gapCenterY + this.gapHeight / 2;
    }

    get bottomHeight() {
      return GAME_HEIGHT - this.bottomY;
    }

    update(dt) {
      this.x -= currentSpeed * dt;

      // Puntuación al cruzar completamente la zona visible del obstáculo
      const visibleRightEdge = this.x + this.width * 0.705;
      if (!this.passed && visibleRightEdge < chatto.x - 15) {
        this.passed = true;
        score++;
        playSound('score');
        if (score > highScore) {
          highScore = score;
          localStorage.setItem('chatto_rocket_high_score', highScore.toString());
        }
        // Aceleración gradual
        currentSpeed = BASE_SPEED + Math.min(110, score * 4);
      }
    }

    draw() {
      const img = images.obstacle;
      if (!img) return;

      // Dibujar obstáculo inferior (orientación normal, extremo inferior alineado con el suelo)
      const bH = this.bottomHeight;
      if (bH > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.x, this.bottomY, this.width, bH);
        ctx.clip();

        const drawH = Math.max(bH, this.width * 2.8);
        ctx.drawImage(img, this.x, this.bottomY, this.width, drawH);
        ctx.restore();
      }

      // Dibujar obstáculo superior (VOLTEADO VERTICALMENTE con ctx.scale(1, -1))
      const tH = this.topHeight;
      if (tH > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.x, 0, this.width, tH);
        ctx.clip();

        ctx.translate(this.x, this.topHeight);
        ctx.scale(1, -1);
        const drawH = Math.max(tH, this.width * 2.8);
        ctx.drawImage(img, 0, 0, this.width, drawH);
        ctx.restore();
      }
    }

    // Comprobación de colisión precisa ajustada a los píxeles visibles del asset
    collidesWith(circle) {
      // El asset Obstaculo.png tiene contenido visible únicamente entre el 29.3% y el 70.8% del ancho
      const visibleLeft = this.x + this.width * 0.295;
      const visibleRight = this.x + this.width * 0.705;

      // Obstáculo superior (invertido): la punta del tubo queda en topHeight
      // En el asset, la punta tiene un pequeño margen transparente superior (~4%)
      if (this.topHeight > 0) {
        const solidTop = 0;
        const solidBottom = this.topHeight - (this.width * 0.04);
        if (circleIntersectsRect(circle.cx, circle.cy, circle.r, visibleLeft, solidTop, visibleRight, solidBottom)) {
          return true;
        }
      }

      // Obstáculo inferior: la punta del tubo mira hacia arriba en bottomY
      if (this.bottomHeight > 0) {
        const solidTop = this.bottomY + (this.width * 0.04);
        const solidBottom = GAME_HEIGHT;
        if (circleIntersectsRect(circle.cx, circle.cy, circle.r, visibleLeft, solidTop, visibleRight, solidBottom)) {
          return true;
        }
      }

      return false;
    }
  }

  function circleIntersectsRect(cx, cy, r, rx1, ry1, rx2, ry2) {
    const closestX = Math.max(rx1, Math.min(cx, rx2));
    const closestY = Math.max(ry1, Math.min(cy, ry2));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (r * r);
  }

  // --- FONDO ESTABLE (ORIGINAL) ---
  function drawBackground() {
    const bg = images.bg;
    if (!bg) {
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      return;
    }

    // Cubrir el canvas proporcionalmente (cover) conservando relación de aspecto y centrado
    const scale = Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height);
    const sw = GAME_WIDTH / scale;
    const sh = GAME_HEIGHT / scale;
    const sx = (bg.width - sw) / 2;
    const sy = (bg.height - sh) / 2;

    ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  // --- REINICIO Y FIN DE PARTIDA ---
  function triggerGameOver() {
    if (currentState === STATE.GAMEOVER) return;
    currentState = STATE.GAMEOVER;
    gameOverTime = performance.now();
    playSound('hit');

    // Si el jugador entra al Top 5, solicitar su nombre
    if (qualifiesForTop(score)) {
      setTimeout(() => {
        promptTopRecord(score);
      }, 400);
    }
  }

  function resetGame() {
    chatto.reset();
    obstacles = [];
    score = 0;
    currentSpeed = BASE_SPEED;
    obstacleTimer = 0;
    // Spawn primer obstáculo más adelante
    obstacles.push(new ObstaclePair(GAME_WIDTH + 80));
  }

  function startGame() {
    resetGame();
    currentState = STATE.PLAYING;
    chatto.jump(); // Primer impulso instantáneo
  }

  // --- GESTIÓN DE ACCIONES DE ENTRADA ---
  function handleAction(event) {
    if (isEnteringRecord) return; // No saltar ni reiniciar mientras se escribe el nombre

    if (event) {
      if (event.type === 'keydown' && event.code !== 'Space') return;
      if (event.cancelable) event.preventDefault();
    }

    const now = performance.now();

    if (currentState === STATE.START) {
      startGame();
    } else if (currentState === STATE.PLAYING) {
      chatto.jump();
    } else if (currentState === STATE.GAMEOVER) {
      // Cooldown de seguridad para no reiniciar por accidente
      if (now - gameOverTime > RESTART_COOLDOWN_MS) {
        startGame();
      }
    }
  }

  // Listeners de teclado, ratón y toque
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) {
        handleAction(e);
      }
    }
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Clic izquierdo
      e.preventDefault();
      handleAction(e);
    }
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleAction(e);
  }, { passive: false });

  // Listener para el botón lateral "¡Jugar!"
  const sidePlayBtn = document.getElementById('side-play-btn');
  if (sidePlayBtn) {
    sidePlayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentState === STATE.START || currentState === STATE.GAMEOVER) {
        handleAction(null);
      } else if (currentState === STATE.PLAYING) {
        chatto.jump();
      }
      canvas.focus();
    });
  }

  // --- DIBUJADO DE INTERFACES ---
  function drawUI() {
    // Sombra de texto general para excelente legibilidad
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    if (currentState === STATE.START) {
      // Título
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 44px "Outfit", sans-serif';
      ctx.fillText('CHATTO ROCKET', GAME_WIDTH / 2, 170);

      // Subtítulo con color acento
      ctx.fillStyle = '#ffb300';
      ctx.font = '600 16px "Outfit", sans-serif';
      ctx.fillText('¡Evita los obstáculos y vuela alto!', GAME_WIDTH / 2, 205);

      // Tarjeta de inicio semitransparente
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(10, 15, 30, 0.65)';
      roundRect(ctx, 35, 455, GAME_WIDTH - 70, 185, 16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Instrucción principal
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 18px "Outfit", sans-serif';
      ctx.fillText('Presiona ESPACIO o haz clic', GAME_WIDTH / 2, 500);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '400 14px "Outfit", sans-serif';
      ctx.fillText('o toca la pantalla para comenzar', GAME_WIDTH / 2, 526);

      // Récord
      ctx.fillStyle = '#fbbf24';
      ctx.font = '800 17px "Outfit", sans-serif';
      ctx.fillText(`🏆 Mejor Récord: ${highScore}`, GAME_WIDTH / 2, 595);

    } else if (currentState === STATE.PLAYING) {
      // Puntuación grande y clara arriba en el centro
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 52px "Outfit", sans-serif';
      ctx.fillText(score.toString(), GAME_WIDTH / 2, 85);

      // Récord pequeño arriba a la derecha
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fbbf24';
      ctx.font = '700 16px "Outfit", sans-serif';
      ctx.fillText(`🏆 ${highScore}`, GAME_WIDTH - 24, 45);

    } else if (currentState === STATE.GAMEOVER) {
      // Banner de Fin de Partida
      ctx.save();
      ctx.fillStyle = 'rgba(5, 8, 18, 0.72)';
      roundRect(ctx, 35, 170, GAME_WIDTH - 70, 370, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.font = '900 38px "Outfit", sans-serif';
      ctx.fillText('¡Fin de la partida!', GAME_WIDTH / 2, 235);

      // Puntuación obtenida
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 15px "Outfit", sans-serif';
      ctx.fillText('PUNTUACIÓN', GAME_WIDTH / 2, 285);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 48px "Outfit", sans-serif';
      ctx.fillText(score.toString(), GAME_WIDTH / 2, 335);

      // Mejor récord
      ctx.fillStyle = '#fbbf24';
      ctx.font = '800 20px "Outfit", sans-serif';
      ctx.fillText(`🏆 Récord: ${highScore}`, GAME_WIDTH / 2, 385);

      // Indicación de reinicio
      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 16px "Outfit", sans-serif';
      ctx.fillText('Presiona ESPACIO, haz clic', GAME_WIDTH / 2, 460);
      ctx.font = '500 14px "Outfit", sans-serif';
      ctx.fillText('o toca para reiniciar', GAME_WIDTH / 2, 485);
    }

    // Resetear sombras
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // --- BUCLE PRINCIPAL (requestAnimationFrame con Delta Time) ---
  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // Máximo 100ms para evitar saltos
    lastTime = timestamp;

    if (currentState === STATE.PLAYING) {
      // Actualizar Chatto
      chatto.update(dt);

      // Actualizar y generar obstáculos
      const cBox = chatto.getCollisionBox();
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.update(dt);

        // Comprobar colisión
        if (obs.collidesWith(cBox)) {
          triggerGameOver();
        }

        // Eliminar obstáculo que sale por la izquierda
        if (obs.x + obs.width < -20) {
          obstacles.splice(i, 1);
        }
      }

      // Generar nuevo obstáculo periódicamente según la distancia
      const lastObstacle = obstacles[obstacles.length - 1];
      if (!lastObstacle || lastObstacle.x <= GAME_WIDTH - PIPE_SPACING) {
        obstacles.push(new ObstaclePair(GAME_WIDTH + 30));
      }

    } else if (currentState === STATE.START) {
      chatto.update(dt);
    }

    // RENDERIZADO
    // 1. Fondo (siempre primero, detrás de todo)
    drawBackground();

    // 2. Obstáculos
    if (currentState === STATE.PLAYING || currentState === STATE.GAMEOVER) {
      for (const obs of obstacles) {
        obs.draw();
      }
    }

    // 3. Personaje Chatto
    chatto.draw();

    // 4. Interfaces y textos
    drawUI();

    requestAnimationFrame(gameLoop);
  }

  // --- CARGA DE ASSETS ---
  function loadAssets(onComplete) {
    let hasError = false;

    Object.entries(ASSET_SOURCES).forEach(([key, src]) => {
      const img = new Image();
      img.onload = () => {
        if (hasError) return;
        images[key] = img;
        loadedCount++;
        loadingText.textContent = `Cargando assets (${loadedCount}/${totalAssets})...`;
        if (loadedCount === totalAssets) {
          onComplete();
        }
      };
      img.onerror = () => {
        hasError = true;
        loadingOverlay.innerHTML = `
          <div style="color:#ef4444; font-size:22px; font-weight:800; margin-bottom:12px;">⚠️ Error de Carga</div>
          <p style="padding:0 24px; text-align:center; font-size:14px; line-height:1.5;">
            No se pudo cargar el asset original:<br><b style="color:#fbbf24;">${src}</b><br><br>
            Verifica que los archivos existan en la carpeta assets/.
          </p>
        `;
      };
      img.src = src;
    });
  }

  // INICIO
  loadAssets(() => {
    loadingOverlay.classList.remove('visible');
    renderLeaderboardUI();
    currentState = STATE.START;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  });

})();
