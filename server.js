const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

const rooms = {};

wss.on('connection', (ws) => {
    ws.id = Math.random().toString(36).substring(2, 9);
    console.log(`[接続成功] ユーザーID: ${ws.id}`);

    ws.on('message', (message) => {
        const data = JSON.parse(message);

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

        // 攻撃データの転送（ここがポイント！）
        if (data.type === 'attack') {
            console.log(`[攻撃発生] ルーム: ${ws.roomId} から ${data.lines}行`);
            if (rooms[ws.roomId]) {
                rooms[ws.roomId].forEach(client => {
                    if (client !== ws) { // 自分以外に送る
                        client.send(JSON.stringify({
                            type: 'attack',
                            lines: data.lines
                        }));
                    }
                });
            }
        }

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
