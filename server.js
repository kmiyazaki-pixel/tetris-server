const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

const rooms = {};

wss.on('connection', (ws) => {
    ws.id = Math.random().toString(36).substring(2, 9);

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'join') {
            ws.roomId = data.roomId;
            if (!rooms[data.roomId]) rooms[data.roomId] = [];
            rooms[data.roomId].push(ws);
            
            // 2人揃ったら開始
            if (rooms[data.roomId].length === 2) {
                rooms[data.roomId].forEach(client => {
                    client.send(JSON.stringify({ type: 'start', userId: client.id }));
                });
            }
        }

        // 全データをそのまま同じ部屋の相手に転送（attack, lose, gameData すべて）
        if (rooms[ws.roomId]) {
            rooms[ws.roomId].forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    data.sender = ws.id;
                    client.send(JSON.stringify(data));
                }
            });
        }
    });

    ws.on('close', () => {
        if (ws.roomId && rooms[ws.roomId]) {
            rooms[ws.roomId] = rooms[ws.roomId].filter(c => c !== ws);
        }
    });
});
