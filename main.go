package main

import (
	"fmt"
	"log"
	"net/http"
	"os"     // ← 追加：Renderの環境設定を読むために必要
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Room struct {
	Clients map[*websocket.Conn]string
	History map[string]interface{}
	mu      sync.Mutex
}

var rooms = make(map[string]*Room)
var roomsMu sync.Mutex

func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	defer ws.Close()

	var userID = fmt.Sprintf("%p", ws)

	for {
		var msg map[string]interface{}
		err := ws.ReadJSON(&msg)
		if err != nil {
			break
		}

		roomID, _ := msg["roomId"].(string)
		msgType, _ := msg["type"].(string)

		roomsMu.Lock()
		if rooms[roomID] == nil {
			rooms[roomID] = &Room{
				Clients: make(map[*websocket.Conn]string),
				History: make(map[string]interface{}),
			}
		}
		room := rooms[roomID]
		roomsMu.Unlock()

		room.mu.Lock()
		switch msgType {
		case "join":
			room.Clients[ws] = userID
			ws.WriteJSON(map[string]interface{}{"type": "start", "userId": userID})
			// 時差入室対策：現在の盤面を即座に共有
			for id, data := range room.History {
				if id != userID {
					ws.WriteJSON(data)
				}
			}

		case "gameData":
			room.History[userID] = msg
			for client := range room.Clients {
				if client != ws {
					client.WriteJSON(msg)
				}
			}

		case "lose":
			for client := range room.Clients {
				if client != ws {
					client.WriteJSON(map[string]interface{}{"type": "lose"})
				}
			}
		}
		room.mu.Unlock()
	}

	// 退出処理
	roomsMu.Lock()
	for rID, room := range rooms {
		room.mu.Lock()
		delete(room.Clients, ws)
		if len(room.Clients) == 0 {
			delete(rooms, rID)
		}
		room.mu.Unlock()
	}
	roomsMu.Unlock()
}

func main() {
    port := os.Getenv("PORT")
    if port == "" {
        port = "10000" // Renderのデフォルトは10000が多いです
    }
    http.HandleFunc("/", handleConnections)
    fmt.Println("Server started on :" + port)
    
    // "0.0.0.0" を指定することで、外からの通信を逃さずキャッチします
    log.Fatal(http.ListenAndServe("0.0.0.0:"+port, nil)) 
}
