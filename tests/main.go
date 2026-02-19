package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-sql-driver/mysql"
	"github.com/gorilla/websocket"
	"golang.org/x/crypto/bcrypt"
)

var (
	db *sql.DB

	FRONTEND_ORIGIN = getEnv("FRONTEND_ORIGIN", "http://localhost:5173")

	sessions   = make(map[string]Session)
	sessionMux sync.RWMutex

	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)

type Session struct {
	UserID int
}

func main() {
	cfg := mysql.Config{
		User:                 getEnv("DB_USER", "root"),
		Passwd:               getEnv("DB_PASSWORD", ""),
		Net:                  "tcp",
		Addr:                 getEnv("DB_HOST", "localhost") + ":" + getEnv("DB_PORT", "3306"),
		DBName:               getEnv("DB_NAME", "auc"),
		AllowNativePasswords: true,
		ParseTime:            true,
	}

	var err error
	db, err = sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		log.Fatal(err)
	}

	db.SetMaxOpenConns(5)

	r := gin.Default()

	r.Use(corsMiddleware())

	r.POST("/register", handleRegister)
	r.POST("/login", handleLogin)
	r.GET("/dashboard", authMiddleware(), handleDashboard)
	r.POST("/create", authMiddleware(), handleCreateAuction)
	r.GET("/api/auction/:id", handleGetAuction)

	r.GET("/auction/:id", handleAuctionWS)

	port := getEnv("PORT", "3000")
	log.Println("Server running on http://localhost:" + port)
	r.Run(":" + port)
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", FRONTEND_ORIGIN)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		cookie, err := c.Request.Cookie("session")
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
			return
		}

		sessionMux.RLock()
		session, ok := sessions[cookie.Value]
		sessionMux.RUnlock()

		if !ok {
			c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
			return
		}

		c.Set("userId", session.UserID)
		c.Next()
	}
}

func createSession(userID int) string {
	token := strconv.FormatInt(time.Now().UnixNano(), 36)

	sessionMux.Lock()
	sessions[token] = Session{UserID: userID}
	sessionMux.Unlock()

	return token
}

func handleRegister(c *gin.Context) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&body); err != nil ||
		body.Email == "" || body.Password == "" {
		c.JSON(400, gin.H{"error": "Email and password required"})
		return
	}

	var exists int
	err := db.QueryRow("SELECT id FROM users WHERE email=? LIMIT 1", body.Email).Scan(&exists)
	if err == nil {
		c.JSON(409, gin.H{"error": "User exists"})
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(body.Password), 10)

	res, err := db.Exec(
		"INSERT INTO users (email, password_hash) VALUES (?,?)",
		body.Email, hash,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "Internal error"})
		return
	}

	id, _ := res.LastInsertId()

	token := createSession(int(id))

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	c.JSON(201, gin.H{
		"id":    id,
		"email": body.Email,
	})
}

func handleLogin(c *gin.Context) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	c.ShouldBindJSON(&body)

	var id int
	var hash string

	err := db.QueryRow(
		"SELECT id,password_hash FROM users WHERE email=? LIMIT 1",
		body.Email,
	).Scan(&id, &hash)

	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
		c.JSON(401, gin.H{"error": "Invalid credentials"})
		return
	}

	token := createSession(id)

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	c.JSON(200, gin.H{
		"id":    id,
		"email": body.Email,
	})
}

func handleDashboard(c *gin.Context) {
	userID := c.GetInt("userId")

	c.JSON(200, gin.H{
		"userId":  userID,
		"message": "Dashboard placeholder",
	})
}

func handleCreateAuction(c *gin.Context) {
	userID := c.GetInt("userId")

	var body struct {
		Item          string  `json:"item"`
		StartingPrice float64 `json:"startingPrice"`
		Image         string  `json:"image"`
		EndTime       string  `json:"endTime"`
	}

	if err := c.ShouldBindJSON(&body); err != nil ||
		body.Item == "" || body.EndTime == "" {
		c.JSON(400, gin.H{"error": "Invalid input"})
		return
	}

	endTime, err := time.Parse(time.RFC3339, body.EndTime)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid end time"})
		return
	}

	res, err := db.Exec(
		"INSERT INTO auctions (user_id,item,starting_price,image_url,end_time) VALUES (?,?,?,?,?)",
		userID, body.Item, body.StartingPrice, body.Image, endTime,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "Internal error"})
		return
	}

	id, _ := res.LastInsertId()

	c.JSON(201, gin.H{"auctionId": id})
}

func handleGetAuction(c *gin.Context) {
	id := c.Param("id")

	var auction struct {
		ID        int
		Item      string
		Price     float64
		ImageURL  sql.NullString
		EndTime   time.Time
		CurrentPrice float64
	}

	err := db.QueryRow(`
	SELECT 
		a.id,
		a.item,
		a.starting_price,
		a.image_url,
		a.end_time,
		COALESCE(MAX(b.price), a.starting_price) AS current_price
	FROM auctions a
	LEFT JOIN bids b ON b.auction_id = a.id
	WHERE a.id = ?
	GROUP BY a.id
	`, id).Scan(
		&auction.ID,
		&auction.Item,
		&auction.Price,
		&auction.ImageURL,
		&auction.EndTime,
		&auction.CurrentPrice,
	)

	if err != nil {
		c.JSON(404, gin.H{"error": "Not found"})
		return
	}

	c.JSON(200, gin.H{
		"id":            auction.ID,
		"item":          auction.Item,
		"startingPrice": auction.Price,
		"currentPrice":  auction.CurrentPrice,
		"imageUrl":      auction.ImageURL.String,
		"endTime":       auction.EndTime.Format(time.RFC3339),
	})
}

func handleAuctionWS(c *gin.Context) {
	_, err := c.Request.Cookie("session")
	if err != nil {
		c.JSON(401, gin.H{"error": "Unauthorized"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	auctionID := c.Param("id")
	log.Println("WebSocket connected for auction:", auctionID)

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}
		conn.WriteMessage(websocket.TextMessage, msg)
	}
}
