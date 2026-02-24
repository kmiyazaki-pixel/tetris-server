// ... (中略) ...
        // 2. ゲームデータの転送
        if (data.type === 'gameData') {
            // ... (既存の転送処理) ...
        }

        // 3. 攻撃（お邪魔ブロック）の転送 ★これを追加
        if (data.type === 'attack') {
            if (rooms[ws.roomId]) {
                rooms[ws.roomId].forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'attack',
                            lines: data.lines // 送られてきた行数
                        }));
                    }
                });
            }
        }
// ... (中略) ...
