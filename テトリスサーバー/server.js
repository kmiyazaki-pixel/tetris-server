const WebSocket = require('ws');

// クラウド環境（Render等）のポート、またはローカルの8080を使用
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// 部屋情報を管理 (RoomID => [ws1, ws2])
const rooms = new Map();

wss.on('connection', (ws) => {
    console.log('新規接続がありました');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // ルーム入室処理
            if (data.type === 'join') {
                const roomId = data.roomId;
                if (!rooms.has(roomId)) {
                    rooms.set(roomId, []);
                }
                
                const players = rooms.get(roomId);
                if (players.length < 2) {
                    players.push(ws);
                    ws.roomId = roomId;
                    console.log(`ルーム ${roomId} に入室成功`);
                    
                    if (players.length === 2) {
                        // 2人揃ったら対戦開始合図を両者に送る
                        players.forEach(client => {
                            client.send(JSON.stringify({ type: 'start' }));
                        });
                    }
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: '部屋が満員です' }));
                }
            }

            // ゲームデータの転送
            if (data.type === 'gameData') {
                const players = rooms.get(ws.roomId);
                if (players) {
                    players.forEach(client => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(message);
                        }
                    });
                }
            }
        } catch (e) {
            console.error('パケット解析エラー');
        }
    });

    ws.on('close', () => {
        if (ws.roomId && rooms.has(ws.roomId)) {
            const players = rooms.get(ws.roomId);
            rooms.set(ws.roomId, players.filter(p => p !== ws));
            console.log(`ルーム ${ws.roomId} から退出`);
        }
    });
});

console.log(`中継サーバーがポート ${PORT} で起動しました`);
