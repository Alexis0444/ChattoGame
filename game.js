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
    obstacle: 'assets/Obstaculo.png',
    viga: 'assets/viga.png'
  };

  const images = {};
  let loadedCount = 0;
  const totalAssets = Object.keys(ASSET_SOURCES).length;

  // Variables de puntuación, vigas y Top Récords
  let score = 0; // Distancia (parejas de obstáculos superadas)
  let vigasCollected = 0; // Monedas/vigas recolectadas en la partida actual
  let highScore = parseInt(localStorage.getItem('chatto_rocket_high_score') || '0', 10);
  if (isNaN(highScore)) highScore = 0;
  let maxVigas = parseInt(localStorage.getItem('chatto_rocket_max_vigas') || '0', 10);
  if (isNaN(maxVigas)) maxVigas = 0;

  // Cargar lista de mejores puntajes
  function getLeaderboard() {
    try {
      const stored = localStorage.getItem('chatto_rocket_leaderboard');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    // Valores predeterminados con distancia y vigas
    return [
      { name: 'Chatto Pro', score: 18, vigas: 12 },
      { name: 'Rocket Ace', score: 14, vigas: 9 },
      { name: 'Star Flyer', score: 10, vigas: 6 },
      { name: 'Cosmo Bot', score: 6, vigas: 4 },
      { name: 'Explorer', score: 3, vigas: 2 }
    ];
  }

  function saveLeaderboard(board) {
    try {
      localStorage.setItem('chatto_rocket_leaderboard', JSON.stringify(board));
    } catch (_) {}
  }

  // Verifica si un puntaje califica para el Top 5 (calculado por distancia y vigas)
  function calcScoreWeight(s, v) {
    return s * 100 + (v || 0) * 10;
  }

  function qualifiesForTop(newScore, newVigas) {
    if (newScore <= 0 && newVigas <= 0) return false;
    const board = getLeaderboard();
    if (board.length < 5) return true;
    const lowest = board[board.length - 1];
    return calcScoreWeight(newScore, newVigas) > calcScoreWeight(lowest.score, lowest.vigas || 0);
  }

  let pendingScore = 0;
  let pendingVigas = 0;
  let isEnteringRecord = false;

  function promptTopRecord(newScore, newVigas) {
    const modal = document.getElementById('record-modal');
    const modalScore = document.getElementById('modal-score');
    const modalVigas = document.getElementById('modal-vigas');
    const nameInput = document.getElementById('player-name-input');
    if (!modal || !nameInput) return;

    pendingScore = newScore;
    pendingVigas = newVigas;
    isEnteringRecord = true;
    if (modalScore) modalScore.textContent = newScore.toString();
    if (modalVigas) modalVigas.textContent = newVigas.toString();
    nameInput.value = localStorage.getItem('chatto_rocket_last_player_name') || '';
    modal.classList.add('active');
    setTimeout(() => nameInput.focus(), 150);
  }

  function registerScoreWithName(playerName, finalScore, finalVigas) {
    const trimmed = playerName.trim() || 'Jugador';
    localStorage.setItem('chatto_rocket_last_player_name', trimmed);

    const board = getLeaderboard();
    board.push({ name: trimmed, score: finalScore, vigas: finalVigas });
    board.sort((a, b) => calcScoreWeight(b.score, b.vigas || 0) - calcScoreWeight(a.score, a.vigas || 0));
    const top5 = board.slice(0, 5);
    saveLeaderboard(top5);
    renderLeaderboardUI();
  }

  function renderLeaderboardUI() {
    const listEl = document.getElementById('leaderboard-list');
    const mobileListEl = document.getElementById('mobile-leaderboard-list');
    const bestDisplay = document.getElementById('best-score-display');
    if (bestDisplay) bestDisplay.textContent = `${highScore} pts | 🏗️ ${maxVigas}`;

    const board = getLeaderboard();

    const generateItemsHtml = () => {
      return board.map((item, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
        const vCount = item.vigas !== undefined ? item.vigas : 0;
        return `
          <li class="leaderboard-item rank-${index + 1}">
            <div class="leaderboard-rank">
              <span class="rank-badge">${medal}</span>
              <span class="player-name">${escapeHtml(item.name)}</span>
            </div>
            <div class="leaderboard-scores">
              <span class="score-tag dist" title="Distancia">🎯 ${item.score}</span>
              <span class="score-tag vigas" title="Vigas">🏗️ ${vCount}</span>
            </div>
          </li>
        `;
      }).join('');
    };

    const itemsHtml = generateItemsHtml();
    if (listEl) listEl.innerHTML = itemsHtml;
    if (mobileListEl) mobileListEl.innerHTML = itemsHtml;
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
      registerScoreWithName(enteredName, pendingScore, pendingVigas);
      if (modal) modal.classList.remove('active');
      isEnteringRecord = false;
      gameOverTime = performance.now(); // reset cooldown tras guardar

      // Si estamos en pantalla móvil, mostrar ahora el top completo
      if (window.innerWidth <= 1060) {
        showMobileLeaderboardModal(pendingScore, pendingVigas);
      }
    });
  }

  // Modal y botón flotante de Top para móvil
  const mobileTrophyBtn = document.getElementById('mobile-trophy-btn');
  const mobileLbModal = document.getElementById('mobile-leaderboard-modal');
  const mobileLbCloseBtn = document.getElementById('mobile-lb-close-btn');
  const mobileLbDismissX = document.getElementById('mobile-lb-dismiss-x');

  function showMobileTrophyBtn() {
    // Se muestra si la pantalla es móvil / estrecha
    if (mobileTrophyBtn && window.innerWidth <= 1060) {
      mobileTrophyBtn.classList.add('visible');
    }
  }

  function hideMobileTrophyBtn() {
    if (mobileTrophyBtn) {
      mobileTrophyBtn.classList.remove('visible');
    }
  }

  function showMobileLeaderboardModal(finalScore, finalVigas) {
    const scoreEl = document.getElementById('mobile-lb-final-score');
    const vigasEl = document.getElementById('mobile-lb-final-vigas');
    if (!mobileLbModal) return;
    if (scoreEl) scoreEl.textContent = (finalScore !== undefined ? finalScore : score).toString();
    if (vigasEl) vigasEl.textContent = (finalVigas !== undefined ? finalVigas : vigasCollected).toString();
    renderLeaderboardUI();
    mobileLbModal.classList.add('active');
  }

  function hideMobileLeaderboardModal() {
    if (mobileLbModal) mobileLbModal.classList.remove('active');
  }

  // Clic en el botón flotante del trofeo para abrir el Top
  if (mobileTrophyBtn) {
    mobileTrophyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      playSound('score');
      showMobileLeaderboardModal(score, vigasCollected);
    });
    mobileTrophyBtn.addEventListener('touchend', (e) => {
      e.stopPropagation();
      e.preventDefault();
      playSound('score');
      showMobileLeaderboardModal(score, vigasCollected);
    });
  }

  // Botón "Jugar de Nuevo" en el modal
  if (mobileLbCloseBtn) {
    mobileLbCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideMobileLeaderboardModal();
      startGame();
    });
  }

  // Botón "X" para solo cerrar el modal y seguir viendo la pantalla de GameOver
  if (mobileLbDismissX) {
    mobileLbDismissX.addEventListener('click', (e) => {
      e.stopPropagation();
      hideMobileLeaderboardModal();
    });
    mobileLbDismissX.addEventListener('touchend', (e) => {
      e.stopPropagation();
      hideMobileLeaderboardModal();
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
      } else if (type === 'coin') {
        // Sonido de recolección de viga / moneda espacial
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(620, now);
        osc.frequency.setValueAtTime(940, now + 0.06);
        osc.frequency.setValueAtTime(1260, now + 0.12);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);
        osc.start(now);
        osc.stop(now + 0.24);
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

  // --- MONEDAS VIGA COLECCIONABLES ---
  let beams = [];
  const BEAM_SIZE = 72; // Tamaño aumentado de la viga (un poquito más grande y llamativa)
  let obstaclePairCount = 0; // Contador de parejas generadas para alternar ("uno sí, uno no")

  class BeamItem {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.baseY = y;
      this.width = BEAM_SIZE;
      this.height = BEAM_SIZE;
      this.collected = false;
      this.bobbingAngle = Math.random() * Math.PI * 2;
      this.spinAngle = 0;
    }

    update(dt) {
      this.x -= currentSpeed * dt;
      this.bobbingAngle += dt * 3.5;
      this.y = this.baseY + Math.sin(this.bobbingAngle) * 8; // Efecto flotante suave
      this.spinAngle += dt * 2.5; // Efecto rotativo sutil
    }

    draw() {
      if (this.collected) return;
      const img = images.viga;
      if (!img) return;

      ctx.save();
      ctx.translate(this.x, this.y);
      // Brillo dorado / resplandor alrededor de la viga
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 14;

      // Dibujar viga perfectamente centrada con sutil escala pulsante
      const pulse = 1 + Math.sin(this.bobbingAngle * 1.5) * 0.08;
      ctx.scale(pulse, pulse);
      ctx.drawImage(img, -this.width / 2, -this.height / 2, this.width, this.height);
      ctx.restore();
    }

    collidesWith(circle) {
      if (this.collected) return false;
      // Colisión circular entre Chatto y la viga
      const radius = this.width * 0.44;
      const dx = circle.cx - this.x;
      const dy = circle.cy - this.y;
      return (dx * dx + dy * dy) < Math.pow(circle.r + radius, 2);
    }
  }

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

      obstaclePairCount++;

      // Alternancia: uno sí, uno no (en los pares impares)
      // La viga se genera en la línea central exacta (punto medio horizontal)
      // entre el obstáculo de la izquierda y el obstáculo de la derecha.
      // Eje X central = centro del obstáculo actual - mitad de la distancia entre columnas
      // Esto asegura que quede matemáticamente en la línea roja central entre ambas columnas.
      if (obstaclePairCount % 2 === 1 && obstaclePairCount > 1) {
        const exactMidlineX = (this.x + this.width / 2) - (PIPE_SPACING / 2);
        // Altura aleatoria a lo largo de esa línea vertical central (entre 200 y 500 px)
        const randomY = Math.floor(200 + Math.random() * 300);
        beams.push(new BeamItem(exactMidlineX, randomY));
      }
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

    if (vigasCollected > maxVigas) {
      maxVigas = vigasCollected;
      localStorage.setItem('chatto_rocket_max_vigas', maxVigas.toString());
    }

    // Mostrar el botón flotante del trofeo en la esquina superior derecha
    showMobileTrophyBtn();

    // Si entraste al Top 5, abrir automáticamente el registro de récord y luego el top
    if (qualifiesForTop(score, vigasCollected)) {
      setTimeout(() => {
        promptTopRecord(score, vigasCollected);
      }, 400);
    }
    // Si NO entró al top, NO se abre automáticamente: el usuario puede ver la pantalla
    // de GameOver con su puntaje y tiene el botón 🏆 arriba a la derecha para abrir el Top cuando guste.
  }

  function resetGame() {
    chatto.reset();
    obstacles = [];
    beams = [];
    score = 0;
    vigasCollected = 0;
    obstaclePairCount = 0;
    currentSpeed = BASE_SPEED;
    obstacleTimer = 0;
    // Spawn primer obstáculo más adelante
    obstacles.push(new ObstaclePair(GAME_WIDTH + 80));
  }

  function startGame() {
    hideMobileLeaderboardModal();
    hideMobileTrophyBtn();
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
      // Si el modal de móvil está activo, no reiniciar por toque al canvas
      const mobileModal = document.getElementById('mobile-leaderboard-modal');
      if (mobileModal && mobileModal.classList.contains('active')) return;

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
      ctx.fillText('CHATTO ROCKET', GAME_WIDTH / 2, 160);

      // Subtítulo con color acento
      ctx.fillStyle = '#ffb300';
      ctx.font = '600 16px "Outfit", sans-serif';
      ctx.fillText('¡Evita los obstáculos y recolecta vigas!', GAME_WIDTH / 2, 195);

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
      ctx.fillText('Presiona ESPACIO o haz clic', GAME_WIDTH / 2, 495);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '400 14px "Outfit", sans-serif';
      ctx.fillText('o toca la pantalla para comenzar', GAME_WIDTH / 2, 520);

      // Récord con distancia y vigas
      ctx.fillStyle = '#fbbf24';
      ctx.font = '800 16px "Outfit", sans-serif';
      ctx.fillText(`🏆 Mejor: ${highScore} pts | 🏗️ ${maxVigas} vigas`, GAME_WIDTH / 2, 595);

    } else if (currentState === STATE.PLAYING) {
      // Puntuación grande y clara arriba en el centro (distancia)
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 48px "Outfit", sans-serif';
      ctx.fillText(score.toString(), GAME_WIDTH / 2, 75);

      // Contador de vigas en la parte superior izquierda con miniatura de la viga
      ctx.textAlign = 'left';
      const vigaImg = images.viga;
      if (vigaImg) {
        ctx.drawImage(vigaImg, 20, 30, 30, 30);
      }
      ctx.fillStyle = '#fbbf24';
      ctx.font = '900 22px "Outfit", sans-serif';
      ctx.fillText(`x ${vigasCollected}`, 56, 53);

      // Récord pequeño arriba a la derecha
      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 15px "Outfit", sans-serif';
      ctx.fillText(`🏆 ${highScore}`, GAME_WIDTH - 20, 52);

    } else if (currentState === STATE.GAMEOVER) {
      // Banner de Fin de Partida
      ctx.save();
      ctx.fillStyle = 'rgba(5, 8, 18, 0.75)';
      roundRect(ctx, 35, 150, GAME_WIDTH - 70, 395, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.font = '900 36px "Outfit", sans-serif';
      ctx.fillText('¡Fin de la partida!', GAME_WIDTH / 2, 210);

      // Puntuación obtenida (Distancia y Vigas)
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 14px "Outfit", sans-serif';
      ctx.fillText('RESULTADOS', GAME_WIDTH / 2, 250);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '900 32px "Outfit", sans-serif';
      ctx.fillText(`🎯 ${score} pts`, GAME_WIDTH / 2, 290);

      ctx.fillStyle = '#fbbf24';
      ctx.font = '900 30px "Outfit", sans-serif';
      ctx.fillText(`🏗️ ${vigasCollected} vigas`, GAME_WIDTH / 2, 332);

      // Mejor récord
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '800 17px "Outfit", sans-serif';
      ctx.fillText(`🏆 Récords: ${highScore} pts | 🏗️ ${maxVigas}`, GAME_WIDTH / 2, 385);

      // Indicación de reinicio
      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 16px "Outfit", sans-serif';
      ctx.fillText('Presiona ESPACIO, haz clic', GAME_WIDTH / 2, 455);
      ctx.font = '500 14px "Outfit", sans-serif';
      ctx.fillText('o toca para reiniciar', GAME_WIDTH / 2, 480);
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

      const cBox = chatto.getCollisionBox();

      // Actualizar y generar obstáculos
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.update(dt);

        // Comprobar colisión con obstáculo
        if (obs.collidesWith(cBox)) {
          triggerGameOver();
        }

        // Eliminar obstáculo que sale por la izquierda
        if (obs.x + obs.width < -20) {
          obstacles.splice(i, 1);
        }
      }

      // Actualizar y recolectar vigas
      for (let i = beams.length - 1; i >= 0; i--) {
        const b = beams[i];
        b.update(dt);

        // Colisión / recolección con Chatto
        if (!b.collected && b.collidesWith(cBox)) {
          b.collected = true;
          vigasCollected++;
          playSound('coin');
        }

        // Eliminar si sale de pantalla o si ya fue recolectada
        if (b.x + b.width < -30 || (b.collected && b.x < chatto.x - 50)) {
          beams.splice(i, 1);
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

    // 3. Monedas Viga (delante de los obstáculos y fondo)
    if (currentState === STATE.PLAYING || currentState === STATE.GAMEOVER) {
      for (const beam of beams) {
        beam.draw();
      }
    }

    // 4. Personaje Chatto
    chatto.draw();

    // 5. Interfaces y textos
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
