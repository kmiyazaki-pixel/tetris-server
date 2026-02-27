package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// クライアント管理
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// 部屋ごとの状態管理（時差入室対策）
type Room struct {
	Clients map[*websocket.Conn]string // Conn -> UserID
	History map[string]interface{}    // 最新の盤面データを保持
	mu      sync.Mutex
}

var rooms = make(map[string]*Room)
var roomsMu sync.Mutex

func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Fatal(err)
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
			// 1. 入室者にIDを通知
			ws.WriteJSON(map[string]interface{}{"type": "start", "userId": userID})
			
			// 2. 時差入室対策：既にゲームが動いているなら、最新の盤面を送信
			for id, data := range room.History {
				if id != userID {
					ws.WriteJSON(data)
				}
			}

		case "gameData":
			// 最新状態を履歴に保存
			room.History[userID] = msg
			// 他の全員に転送
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

	// 切断処理
	for rID, room := range rooms {
		room.mu.Lock()
		delete(room.Clients, ws)
		if len(room.Clients) == 0 {
			roomsMu.Lock()
			delete(rooms, rID)
			roomsMu.Unlock()
		}
		room.mu.Unlock()
	}
}

// main.go の最後の方
func main() {
	port := os.Getenv("PORT") // Renderからポート番号をもらう
	if port == "" {
		port = "8080" // ローカルテスト用
	}
	http.HandleFunc("/", handleConnections)
	fmt.Println("Server started on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
