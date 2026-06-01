const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const W = canvas.width;
const H = canvas.height;
const GROUND = H - 60;

// Game state
let gameRunning = false;
let score = 0;
let bestScore = 0;
let frameCount = 0;
let cameraX = 0;
let enemySpawnTimer = 0;
let enemySpawnInterval = 120;
let speedIndex = 0;
let worldX = 0; // tracks how far world has generated

// Player
const player = {
  x: 150,
  y: GROUND - 40,
  width: 32,
  height: 32,
  velX: 0,
  velY: 0,
  onGround: false,
  speed: 5
};

// Keys
const keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);

// --- INFINITE WORLD GENERATION ---
let platforms = [];
let coins = [];

function generateWorld(fromX, toX) {
  let x = fromX;
  while (x < toX) {
    // Ground — no gaps, continuous
    const gWidth = 400 + Math.random() * 200;
    platforms.push({ x, y: GROUND, width: gWidth, height: 60, isGround: true });
    x += gWidth -5;

    // Floating platform — lower height, reachable
    if (Math.random() > 0.3) {
      const px = x - 250 + Math.random() * 100;
      const py = GROUND - 90 - Math.random() * 80;
      const pw = 120 + Math.random() * 80;
      platforms.push({ x: px, y: py, width: pw, height: 16, isGround: false });

      // Coin on platform — right on top
      if (Math.random() > 0.2) {
        coins.push({
          x: px + pw / 2 - 8,
          y: py - 20,
          width: 16,
          height: 16,
          collected: false
        });
      }
    }

    // Coin on ground — closer together
    coins.push({
      x: x - 150 + Math.random() * 100,
      y: GROUND - 25,
      width: 16,
      height: 16,
      collected: false
    });

    x += 30 + Math.random() * 60;
  }
  worldX = toX;
}


// Generate initial world
generateWorld(0, 3000);

// Enemies
let enemies = [];
const enemySpeeds = [3.5, 4.5, 4, 5.5, 3.5, 5];

function spawnEnemy() {
  const speed = enemySpeeds[speedIndex % enemySpeeds.length];
  speedIndex++;
  const isBird = Math.random() < 0.3;

  if (isBird) {
    const flyHeights = [H * 0.2, H * 0.35, H * 0.45, H * 0.55];
    const flyY = flyHeights[Math.floor(Math.random() * flyHeights.length)];
    enemies.push({
      x: cameraX + W + 50,
      y: flyY,
      width: 30,
      height: 24,
      speed: speed + 1.5,
      velY: 0,
      type: 'bird',
      flapTimer: 0
    });
  } else {
    enemies.push({
      x: cameraX + W + 50,
      y: GROUND - 32,
      width: 28,
      height: 32,
      speed: speed,
      velY: 0,
      onGround: false,
      type: 'ground'
    });
  }
}

// Lives
let lives = 3;
let invincible = false;
let invincibleTimer = 0;

// --- LEADERBOARD ---
function getLeaderboard() {
  const data = localStorage.getItem('pixelrush_leaderboard');
  return data ? JSON.parse(data) : [];
}

function saveLeaderboard(board) {
  localStorage.setItem('pixelrush_leaderboard', JSON.stringify(board));
}

function addScore(name, sc) {
  const board = getLeaderboard();
  board.push({ name, score: sc });
  board.sort((a, b) => b.score - a.score);
  saveLeaderboard(board.slice(0, 10));
}

function showLeaderboard() {
  const board = getLeaderboard();
  const list = document.getElementById('leaderboardList');
  list.innerHTML = '';
  if (board.length === 0) {
    list.innerHTML = '<li>No scores yet!</li>';
    return;
  }
  board.forEach((entry, i) => {
    const li = document.createElement('li');
    const medals = ['🥇', '🥈', '🥉'];
    li.textContent = `${medals[i] || (i + 1) + '.'} ${entry.name} — ${entry.score}`;
    list.appendChild(li);
  });
}

// --- UPDATE ---
function update() {
  if (!gameRunning) return;

  frameCount++;
  score++;

  // Spawn enemies
  enemySpawnTimer++;
  if (enemySpawnTimer >= enemySpawnInterval) {
    spawnEnemy();
    enemySpawnTimer = 0;
    if (enemySpawnInterval > 60) enemySpawnInterval -= 1;
  }

  // Generate more world ahead
  if (cameraX + W * 2 > worldX) {
    generateWorld(worldX, worldX + 3000);
  }

  // Player movement
  if (keys['ArrowLeft'] || keys['KeyA']) player.velX = -player.speed;
  else if (keys['ArrowRight'] || keys['KeyD']) player.velX = player.speed;
  else player.velX = 0;

  // Jump
  if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && player.onGround) {
    player.velY = -15;
    player.onGround = false;
  }

  // Gravity
  player.velY += 0.6;
  player.x += player.velX;
  player.y += player.velY;

  if (player.x < 0) player.x = 0;

  // Camera
  cameraX = player.x - W * 0.25;
  if (cameraX < 0) cameraX = 0;

  // Platform collision
  player.onGround = false;
  platforms.forEach(p => {
    if (
      player.x + player.width > p.x &&
      player.x < p.x + p.width &&
      player.y + player.height >= p.y &&
      player.y + player.height <= p.y + p.height + 12 &&
      player.velY >= 0
    ) {
      player.y = p.y - player.height;
      player.velY = 0;
      player.onGround = true;
    }
  });

  // Fall death
  if (player.y > H + 50) loseLife();

  // Enemies
  enemies.forEach(e => {
    e.x -= e.speed;

    if (e.type === 'bird') {
      e.flapTimer++;
      e.y += Math.sin(e.flapTimer * 0.05) * 1.5;
    } else {
      e.velY += 0.5;
      e.y += e.velY;
      e.onGround = false;
      platforms.forEach(p => {
        if (
          e.x + e.width > p.x &&
          e.x < p.x + p.width &&
          e.y + e.height >= p.y &&
          e.y + e.height <= p.y + p.height + 10 &&
          e.velY >= 0
        ) {
          e.y = p.y - e.height;
          e.velY = 0;
          e.onGround = true;
        }
      });
    }

    if (
      !invincible &&
      player.x + player.width > e.x &&
      player.x < e.x + e.width &&
      player.y + player.height > e.y &&
      player.y < e.y + e.height
    ) {
      loseLife();
    }
  });

  // Remove off-screen enemies
  enemies = enemies.filter(e => e.x + e.width > cameraX - 100);

  // Remove far-behind platforms and coins to save memory
  platforms = platforms.filter(p => p.x + p.width > cameraX - 200);
  coins = coins.filter(c => c.x > cameraX - 200 || c.collected);

  // Coin collection
  coins.forEach(c => {
    if (
      !c.collected &&
      player.x + player.width > c.x &&
      player.x < c.x + c.width &&
      player.y + player.height > c.y &&
      player.y < c.y + c.height
    ) {
      c.collected = true;
      score += 100;
    }
  });

  // Invincible timer
  if (invincible) {
    invincibleTimer--;
    if (invincibleTimer <= 0) invincible = false;
  }
}

function loseLife() {
  lives--;
  player.x = 150;
  player.y = GROUND - 40;
  player.velX = 0;
  player.velY = 0;
  player.onGround = false;
  cameraX = 0;
  invincible = true;
  invincibleTimer = 120;
  if (lives <= 0) gameOver();
}

// --- DRAW ---
function draw() {
  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a2e');
  grad.addColorStop(1, '#1a1a4e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Stars
  ctx.fillStyle = '#ffffff44';
  for (let i = 0; i < 80; i++) {
    ctx.fillRect((i * 173 + frameCount * 0.2) % W, (i * 97) % (H * 0.7), 2, 2);
  }

  ctx.save();
  ctx.translate(-cameraX, 0);

  // Platforms
  platforms.forEach(p => {
    if (p.x + p.width < cameraX - 50 || p.x > cameraX + W + 50) return;
    if (p.isGround) {
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(p.x, p.y, p.width, 8);
    } else {
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.fillStyle = '#81c784';
      ctx.fillRect(p.x, p.y, p.width, 4);
    }
  });

  // Coins
  coins.forEach(c => {
    if (c.collected) return;
    if (c.x < cameraX - 50 || c.x > cameraX + W + 50) return;
    ctx.fillStyle = '#ffdd57';
    ctx.shadowColor = '#ffdd57';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(c.x + 8, c.y + 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // Enemies
  enemies.forEach(e => {
    if (e.type === 'bird') {
      ctx.fillStyle = '#ff9800';
      ctx.fillRect(e.x, e.y, e.width, e.height);
      const flapUp = Math.sin(e.flapTimer * 0.05) > 0;
      ctx.fillStyle = '#ffb74d';
      if (flapUp) {
        ctx.fillRect(e.x - 8, e.y - 8, 12, 8);
        ctx.fillRect(e.x + e.width - 4, e.y - 8, 12, 8);
      } else {
        ctx.fillRect(e.x - 8, e.y + 8, 12, 8);
        ctx.fillRect(e.x + e.width - 4, e.y + 8, 12, 8);
      }
      ctx.fillStyle = '#000';
      ctx.fillRect(e.x + 4, e.y + 6, 5, 5);
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(e.x - 5, e.y + 8, 7, 5);
    } else {
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(e.x, e.y, e.width, e.height);
      ctx.fillStyle = '#fff';
      ctx.fillRect(e.x + 5, e.y + 6, 6, 6);
      ctx.fillRect(e.x + 17, e.y + 6, 6, 6);
      ctx.fillStyle = '#000';
      ctx.fillRect(e.x + 7, e.y + 8, 3, 3);
      ctx.fillRect(e.x + 19, e.y + 8, 3, 3);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(e.x + 4, e.y + 3, 8, 3);
      ctx.fillRect(e.x + 16, e.y + 3, 8, 3);
    }
  });

  // Player
  let flash = invincible && frameCount % 10 < 5;
  if (!flash) {
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(player.x + 6, player.y + 8, 6, 6);
    ctx.fillRect(player.x + 18, player.y + 8, 6, 6);
    ctx.fillStyle = '#000';
    ctx.fillRect(player.x + 8, player.y + 10, 3, 3);
    ctx.fillRect(player.x + 20, player.y + 10, 3, 3);
  }

  ctx.restore();

  // HUD
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Segoe UI';
  ctx.fillText('Score: ' + score, 20, 40);
  ctx.fillStyle = '#ffdd57';
  ctx.fillText('Coins: ' + coins.filter(c => c.collected).length, 20, 70);
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 22px Segoe UI';
  ctx.fillText('❤️ x' + lives, W - 100, 40);
}

// --- GAME OVER ---
function gameOver() {
  gameRunning = false;
  if (score > bestScore) bestScore = score;
  document.getElementById('finalScore').textContent = score;
  document.getElementById('bestScore').textContent = bestScore;
  document.getElementById('gameOverScreen').classList.remove('hidden');
  const name = prompt('Enter your name for leaderboard:') || 'Player';
  addScore(name, score);
}

function resetGame() {
  score = 0;
  lives = 3;
  frameCount = 0;
  cameraX = 0;
  enemySpawnTimer = 0;
  enemySpawnInterval = 120;
  speedIndex = 0;
  worldX = 0;
  enemies = [];
  platforms = [];
  coins = [];
  generateWorld(0, 3000);
  player.x = 150;
  player.y = GROUND - 40;
  player.velX = 0;
  player.velY = 0;
  player.onGround = false;
  invincible = false;
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('leaderboardSection').classList.add('hidden');
  gameRunning = true;
}

// --- BUTTONS ---
document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('menuScreen').classList.add('hidden');
  gameRunning = true;
});

document.getElementById('restartBtn').addEventListener('click', () => {
  resetGame();
});

const lbBtn = document.getElementById('viewLeaderboardBtn');
if (lbBtn) {
  lbBtn.addEventListener('click', () => {
    showLeaderboard();
    document.getElementById('leaderboardSection').classList.remove('hidden');
  });
}

document.getElementById('closeLeaderboardBtn').addEventListener('click', () => {
  document.getElementById('leaderboardSection').classList.add('hidden');
});

// --- GAME LOOP ---
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();


