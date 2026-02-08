const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const restartBtn = document.getElementById('restart-btn');

// Game variables
let player = { x: 175, y: 550, width: 50, height: 50, color: '#4CAF50', speed: 5 };
let blocks = [];
let score = 0;
let gameRunning = true;
let animationId;
let frameCount = 0;
let difficulty = 1;

// Input handling
let keys = {};
document.addEventListener('keydown', (e) => keys[e.code] = true);
document.addEventListener('keyup', (e) => keys[e.code] = false);

restartBtn.addEventListener('click', startGame);

function startGame() {
    player.x = 175;
    blocks = [];
    score = 0;
    difficulty = 1;
    scoreElement.textContent = score;
    gameRunning = true;
    restartBtn.style.display = 'none';
    animate();
}

function update() {
    if (!gameRunning) return;

    // Player movement
    if (keys['ArrowLeft'] && player.x > 0) {
        player.x -= player.speed;
    }
    if (keys['ArrowRight'] && player.x + player.width < canvas.width) {
        player.x += player.speed;
    }

    // Generate blocks
    if (frameCount % (60 - difficulty * 2) === 0) { 
        // Cap difficulty speed increase to avoid too many blocks too fast
        const safeDifficulty = Math.min(difficulty, 20);
        const blockWidth = Math.random() * 50 + 20;
        const blockX = Math.random() * (canvas.width - blockWidth);
        const blockSpeed = 3 + difficulty * 0.2;
        blocks.push({ x: blockX, y: -50, width: blockWidth, height: 20, color: '#FF5722', speed: blockSpeed });
    }

    // Update blocks
    for (let i = 0; i < blocks.length; i++) {
        blocks[i].y += blocks[i].speed;

        // Collision detection
        if (
            player.x < blocks[i].x + blocks[i].width &&
            player.x + player.width > blocks[i].x &&
            player.y < blocks[i].y + blocks[i].height &&
            player.y + player.height > blocks[i].y
        ) {
            gameOver();
        }

        // Remove blocks that are off screen and increase score
        if (blocks[i].y > canvas.height) {
            blocks.splice(i, 1);
            score++;
            scoreElement.textContent = score;
            i--;
            
            // Increase difficulty every 10 points
            if (score % 10 === 0) {
                difficulty++;
            }
        }
    }
    
    frameCount++;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Draw blocks
    ctx.fillStyle = '#FF5722';
    for (let block of blocks) {
        ctx.fillRect(block.x, block.y, block.width, block.height);
    }
}

function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
    
    restartBtn.style.display = 'block';
}

function animate() {
    if (!gameRunning) return;
    update();
    draw();
    animationId = requestAnimationFrame(animate);
}

// Start the game initially
startGame();
