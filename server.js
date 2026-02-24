<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Tetris Online Battle</title>
    <style>
        body { background: #1a1a1a; color: white; text-align: center; font-family: sans-serif; margin: 0; overflow: hidden; }
        #status { background: #4caf50; padding: 8px; font-weight: bold; font-size: 14px; height: 20px; }
        .game-area { display: flex; justify-content: center; gap: 10px; margin-top: 15px; }
        .player-label { font-size: 12px; margin-bottom: 5px; color: #aaa; }
        canvas { background: #000; border: 2px solid #333; width: 140px; height: 280px; }
        .controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 90%; max-width: 320px; margin: 20px auto; }
        button { background: #333; color: white; border: none; padding: 20px; font-size: 20px; border-radius: 12px; touch-action: manipulation; border-bottom: 4px solid #111; }
        button:active { border-bottom: 0; transform: translateY(4px); }
        .rotate { background: #2196f3; }
        .drop { grid-column: span 3; background: #f44336; }
    </style>
</head>
<body>
    <div id="status">接続を待機中...</div>
    
    <div class="game-area">
        <div>
            <div class="player-label">YOU (自分)</div>
            <canvas id="localCanvas"></canvas>
        </div>
        <div>
            <div class="player-label">RIVAL (相手)</div>
            <canvas id="remoteCanvas"></canvas>
        </div>
    </div>

    <div class="controls">
        <button onclick="handleInput('left')">←</button>
        <button class="rotate" onclick="handleInput('rotate')">回転</button>
        <button onclick="handleInput('right')">→</button>
        <button class="drop" onclick="handleInput('drop')">即時落下</button>
    </div>

    <script>
        const SERVER_URL = 'wss://tetris-server-7w6p.onrender.com';
        const COLS = 10, ROWS = 20, BLOCK_SIZE = 20;
        let socket, roomId, myId, isStarted = false;
        
        const localCtx = document.getElementById('localCanvas').getContext('2d');
        const remoteCtx = document.getElementById('remoteCanvas').getContext('2d');
        document.querySelectorAll('canvas').forEach(c => { c.width = COLS * BLOCK_SIZE; c.height = ROWS * BLOCK_SIZE; });

        // 自分と相手の状態を保持
        let board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
        let piece = null;
        let remoteBoard = Array.from({length: ROWS}, () => Array(COLS).fill(0));
        let remotePiece = null;

        const COLORS = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];
        const SHAPES = [null, [[1,1,1,1]], [[1,1],[1,1]], [[0,1,0],[1,1,1]], [[1,1,0],[0,1,1]], [[0,1,1],[1,1,0]], [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]]];

        function connect() {
            roomId = prompt("ルームIDを入力してください", "0707");
            socket = new WebSocket(SERVER_URL);
            
            socket.onopen = () => {
                document.getElementById('status').innerText = "相手を待っています...";
                socket.send(JSON.stringify({ type: 'join', roomId: roomId }));
            };

            socket.onmessage = (e) => {
                const data = JSON.parse(e.data);
                
                if (data.type === 'start') {
                    document.getElementById('status').innerText = "対戦開始！";
                    isStarted = true;
                    myId = data.userId;
                    if(!piece) {
                        piece = createPiece();
                        requestAnimationFrame(gameLoop);
                    }
                }
                
                if (data.type === 'gameData' && data.sender !== myId) {
                    // 相手のデータを変数に保存
                    remoteBoard = data.board;
                    remotePiece = data.piece;
                }
            };
        }

        function sendData() {
            if (socket && socket.readyState === WebSocket.OPEN && isStarted) {
                socket.send(JSON.stringify({
                    type: 'gameData',
                    roomId: roomId,
                    board: board,
                    piece: piece
                }));
            }
        }

        // --- ゲームコア ---
        function createPiece() {
            const id = Math.floor(Math.random() * 7) + 1;
            return { id, matrix: SHAPES[id], x: 3, y: 0 };
        }

        function collide(b, p) {
            for (let y = 0; y < p.matrix.length; y++) {
                for (let x = 0; x < p.matrix[y].length; x++) {
                    if (p.matrix[y][x] && (b[y + p.y] && b[y + p.y][x + p.x]) !== 0) return true;
                }
            }
            return false;
        }

        function handleInput(type) {
            if (!isStarted || !piece) return;
            if (type === 'left') { piece.x--; if(collide(board, piece)) piece.x++; }
            if (type === 'right') { piece.x++; if(collide(board, piece)) piece.x--; }
            if (type === 'rotate') {
                const pre = piece.matrix;
                piece.matrix = rotate(piece.matrix);
                if(collide(board, piece)) piece.matrix = pre;
            }
            if (type === 'drop') {
                while(!collide(board, piece)) { piece.y++; }
                piece.y--;
                drop();
            }
            sendData();
        }

        function rotate(matrix) { return matrix[0].map((_, i) => matrix.map(row => row[i]).reverse()); }

        function drop() {
            if (!isStarted || !piece) return;
            piece.y++;
            if (collide(board, piece)) {
                piece.y--;
                p_merge(board, piece);
                p_clear();
                piece = createPiece();
                if (collide(board, piece)) {
                    isStarted = false;
                    alert("GAME OVER");
                    board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
                }
            }
            sendData();
        }

        function p_merge(b, p) {
            p.matrix.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) b[y + p.y][x + p.x] = p.id;
                });
            });
        }

        function p_clear() {
            for (let y = ROWS - 1; y >= 0; y--) {
                if (board[y].every(cell => cell !== 0)) {
                    board.splice(y, 1);
                    board.unshift(Array(COLS).fill(0));
                    y++;
                }
            }
        }

        function drawBoard(ctx, b, p) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            b.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        ctx.fillStyle = COLORS[value];
                        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
                    }
                });
            });
            if(p) {
                ctx.fillStyle = COLORS[p.id];
                p.matrix.forEach((row, y) => {
                    row.forEach((value, x) => {
                        if (value) ctx.fillRect((p.x + x) * BLOCK_SIZE, (p.y + y) * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
                    });
                });
            }
        }

        let lastTime = 0;
        let dropCounter = 0;
        function gameLoop(time = 0) {
            if (!isStarted) return;
            const deltaTime = time - lastTime;
            lastTime = time;
            dropCounter += deltaTime;
            if (dropCounter > 1000) {
                drop();
                dropCounter = 0;
            }
            // 自分の画面と相手の画面を毎フレーム描き直す
            drawBoard(localCtx, board, piece);
            drawBoard(remoteCtx, remoteBoard, remotePiece);
            requestAnimationFrame(gameLoop);
        }

        connect();
    </script>
</body>
</html>
