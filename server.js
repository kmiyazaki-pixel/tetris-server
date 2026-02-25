const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

const rooms = {};

wss.on('connection', (ws) => {
    ws.id = Math.random().toString(36).substring(2, 9);

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        // ルーム入室
        if (data.type === 'join') {
            ws.roomId = data.roomId;
            if (!rooms[data.roomId]) rooms[data.roomId] = [];
            rooms[data.roomId].push(ws);
            if (rooms[data.roomId].length === 2) {
                rooms[data.roomId].forEach(client => {
                    client.send(JSON.stringify({ type: 'start', userId: client.id }));
                });
            }
        }

        // 誰かが負けた時の処理（審判機能）
        if (data.type === 'lose') {
            if (rooms[ws.roomId]) {
                rooms[ws.roomId].forEach(client => {
                    if (client === ws) {
                        // 負けた本人に通知
                        client.send(JSON.stringify({ type: 'game_result', result: 'lose' }));
                    } else {
                        // 相手に勝利を通知
                        client.send(JSON.stringify({ type: 'game_result', result: 'win' }));
                    }
                });
            }
        }

        // 攻撃の転送
        if (data.type === 'attack') {
            if (rooms[ws.roomId]) {
                rooms[ws.roomId].forEach(client => {
                    if (client !== ws) {
                        client.send(JSON.stringify({ type: 'attack', lines: data.lines }));
                    }
                });
            }
        }

        // 盤面データの転送
        if (data.type === 'gameData') {
            if (rooms[ws.roomId]) {
                rooms[ws.roomId].forEach(client => {
                    if (client !== ws) {
                        data.sender = ws.id;
                        client.send(JSON.stringify(data));
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        if (ws.roomId && rooms[ws.roomId]) {
            rooms[ws.roomId] = rooms[ws.roomId].filter(c => c !== ws);
        }
    });
});
