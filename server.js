const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

const rooms = {};

wss.on('connection', (ws) => {
    // 接続した瞬間に一意のIDを割り当てる
    ws.id = Math.random().toString(36).substring(2, 9);
    console.log(`[接続] ユーザーID: ${ws.id}`);

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        // 1. ルーム入室処理
        if (data.type === 'join') {
            ws.roomId = data.roomId;
            if (!rooms[data.roomId]) {
                rooms[data.roomId] = [];
            }
            rooms[data.roomId].push(ws);
            console.log(`[入室] ルーム: ${data.roomId}, ID: ${ws.id}`);

            // 2人揃ったら「開始」合図を出す
            if (rooms[data.roomId].length === 2) {
                rooms[data.roomId].forEach(client => {
                    client.send(JSON.stringify({ type: 'start', userId: client.id }));
                });
            }
        }

        // 2. ゲームデータの転送（ここが重要！）
        if (data.type === 'gameData') {
            if (rooms[ws.roomId]) {
                rooms[ws.roomId].forEach(client => {
                    // 自分以外（相手）にだけデータを送る
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        // 送信者のIDを付け加えて送り返す
                        data.sender = ws.id;
                        client.send(JSON.stringify(data));
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        if (ws.roomId && rooms[ws.roomId]) {
            rooms[ws.roomId] = rooms[ws.roomId].filter(client => client !== ws);
            console.log(`[切断] ルーム: ${ws.roomId}, ID: ${ws.id}`);
        }
    });
});

console.log('サーバー起動中...');
