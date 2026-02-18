package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/confluentinc/confluent-kafka-go/kafka"
	"github.com/gorilla/websocket"
)

type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

func (h *Hub) Run() {
	for {
		select {

		case conn := <-h.register:
			h.clients[conn] = true
			log.Println("Client connected. Total:", len(h.clients))

		case conn := <-h.unregister:
			if _, ok := h.clients[conn]; ok {
				delete(h.clients, conn)
				conn.Close()
				log.Println("Client disconnected. Total:", len(h.clients))
			}

		case msg := <-h.broadcast:
			for conn := range h.clients {
				err := conn.WriteMessage(websocket.TextMessage, msg)
				if err != nil {
					conn.Close()
					delete(h.clients, conn)
				}
			}
		}
	}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // allow all origins (dev only)
	},
}

func wsHandler(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("Upgrade error:", err)
			return
		}

		hub.register <- conn

		// Reader goroutine to detect disconnect
		go func() {
			defer func() {
				hub.unregister <- conn
			}()

			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					break
				}
			}
		}()
	}
}

func main() {

	// Create hub
	hub := NewHub()
	go hub.Run()

	// Kafka consumer
	consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": "localhost:9092",
		"group.id":          "auction-ws-group",
		"auto.offset.reset": "latest",
	})
	if err != nil {
		panic(err)
	}
	defer consumer.Close()

	err = consumer.SubscribeTopics([]string{"bids"}, nil)
	if err != nil {
		panic(err)
	}

	// Kafka consumer loop
	go func() {
		for {
			msg, err := consumer.ReadMessage(100)
			if err == nil {
				log.Printf("Kafka received: %s\n", string(msg.Value))
				hub.broadcast <- msg.Value
			} else {
				if kafkaErr, ok := err.(kafka.Error); ok && kafkaErr.Code() != kafka.ErrTimedOut {
					log.Println("Kafka error:", err)
				}
			}
		}
	}()

	// HTTP server
	http.HandleFunc("/ws", wsHandler(hub))

	go func() {
		log.Println("WebSocket server running on :8081")
		if err := http.ListenAndServe(":8081", nil); err != nil {
			log.Fatal(err)
		}
	}()

	// Graceful shutdown
	sigchan := make(chan os.Signal, 1)
	signal.Notify(sigchan, syscall.SIGINT, syscall.SIGTERM)

	sig := <-sigchan
	fmt.Println("Received signal:", sig)
	fmt.Println("Shutting down...")

	consumer.Close()
}
