package main

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var (
	upgrader    = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	clients     = make(map[*websocket.Conn]bool)
	clientsMu   sync.Mutex
	currentPrice float64
)

// Broadcast the current price to all connected clients
func broadcastPrice() {
	clientsMu.Lock()
	defer clientsMu.Unlock()

	msg := fmt.Sprintf(`{"auctionID":2,"highestPrice":%.2f}`, currentPrice)
	for conn := range clients {
		if err := conn.WriteMessage(websocket.TextMessage, []byte(msg)); err != nil {
			log.Println("WS write error, removing client:", err)
			conn.Close()
			delete(clients, conn)
		}
	}
}

// WebSocket handler
func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WS upgrade error:", err)
		return
	}
	defer func() {
		clientsMu.Lock()
		delete(clients, conn)
		clientsMu.Unlock()
		conn.Close()
	}()

	// Register client
	clientsMu.Lock()
	clients[conn] = true
	clientsMu.Unlock()

	log.Println("Client connected")

	// Send the current price immediately
	msg := fmt.Sprintf(`{"auctionID":2,"highestPrice":%.2f}`, currentPrice)
	if err := conn.WriteMessage(websocket.TextMessage, []byte(msg)); err != nil {
		log.Println("WS write error:", err)
		return
	}

	// Keep connection alive
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}
}

func main() {
	rand.Seed(time.Now().UnixNano())
	currentPrice = 0

	// Update the price every 0.5s and broadcast
	go func() {
		for {
			currentPrice = float64(rand.Intn(100001)) // 0-100000
			broadcastPrice()
			time.Sleep(500 * time.Millisecond)
		}
	}()

	http.HandleFunc("/ws", wsHandler)
	log.Println("WebSocket server running on :8081")
	log.Fatal(http.ListenAndServe(":8081", nil))
}
