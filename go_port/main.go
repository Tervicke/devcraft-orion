package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-sql-driver/mysql"
	"github.com/gorilla/websocket"
	"golang.org/x/crypto/bcrypt"
)

type Session struct {
	UserID int64
}

var (
	db       *sql.DB
	sessions = make(map[string]Session)
	// In a real app you would protect this with a mutex.
)

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func initDB() {
	cfg := mysql.Config{
		User:                 getEnv("DB_USER", "tervicke"),
		Passwd:               getEnv("DB_PASSWORD", "password"),
		Net:                  "tcp",
		Addr:                 getEnv("DB_HOST", "localhost") + ":" + getEnv("DB_PORT", "3306"),
		DBName:               getEnv("DB_NAME", "auc"),
		AllowNativePasswords: true,
		ParseTime:            true,
	}

	var err error
	db, err = sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		log.Fatalf("error opening DB: %v", err)
	}

	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	if err := db.Ping(); err != nil {
		log.Fatalf("error pinging DB: %v", err)
	}
}

func frontendOrigin() string {
	return getEnv("FRONTEND_ORIGIN", "http://localhost:5173")
}

// corsMiddleware replicates the Bun CORS behavior.
func corsMiddleware() gin.HandlerFunc {
	origin := frontendOrigin()
	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("Access-Control-Allow-Origin", origin)
		h.Set("Access-Control-Allow-Credentials", "true")
		h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		h.Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

		if c.Request.Method == http.MethodOptions {
			c.Status(http.StatusNoContent)
			c.Abort()
			return
		}

		c.Next()
	}
}

func parseSessionCookie(c *gin.Context) *Session {
	cookie, err := c.Request.Cookie("session")
	if err != nil || cookie.Value == "" {
		return nil
	}
	if s, ok := sessions[cookie.Value]; ok {
		return &s
	}
	return nil
}

func createSession(userID int64) string {
	token := strconv.FormatInt(time.Now().UnixNano(), 36) + "-" + strconv.FormatInt(userID, 36)
	sessions[token] = Session{UserID: userID}
	return token
}

func setSessionCookie(c *gin.Context, token string) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func requireSession(c *gin.Context) *Session {
	s := parseSessionCookie(c)
	if s == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return nil
	}
	return s
}

func handleRegister(c *gin.Context) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Email == "" || body.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email and password are required"})
		return
	}

	var existingID int64
	err := db.QueryRow("SELECT id FROM users WHERE email = ? LIMIT 1", body.Email).Scan(&existingID)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("error checking existing user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User with this email already exists"})
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 10)
	if err != nil {
		log.Printf("error hashing password: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	res, err := db.Exec("INSERT INTO users (email, password_hash) VALUES (?, ?)", body.Email, string(passwordHash))
	if err != nil {
		log.Printf("error inserting user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	userID, err := res.LastInsertId()
	if err != nil {
		log.Printf("error getting insert id: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	token := createSession(userID)
	setSessionCookie(c, token)
	c.JSON(http.StatusCreated, gin.H{"id": userID, "email": body.Email})
}

func handleLogin(c *gin.Context) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Email == "" || body.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email and password are required"})
		return
	}

	var (
		userID       int64
		passwordHash string
	)
	err := db.QueryRow("SELECT id, password_hash FROM users WHERE email = ? LIMIT 1", body.Email).Scan(&userID, &passwordHash)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}
	if err != nil {
		log.Printf("error selecting user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(body.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	token := createSession(userID)
	setSessionCookie(c, token)
	c.JSON(http.StatusOK, gin.H{"id": userID, "email": body.Email})
}

func handleDashboard(c *gin.Context) {
	s := requireSession(c)
	if s == nil {
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "Dashboard data placeholder",
		"userId":  s.UserID,
	})
}

func handleCreateAuction(c *gin.Context) {
	s := requireSession(c)
	if s == nil {
		return
	}

	var body struct {
		Item          string   `json:"item"`
		StartingPrice *float64 `json:"startingPrice"`
		Image         *string  `json:"image"`
		EndTime       string   `json:"endTime"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Item == "" || body.StartingPrice == nil || body.EndTime == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Item, starting price, and end time are required"})
		return
	}

	endTime, err := time.Parse(time.RFC3339, body.EndTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end time"})
		return
	}

	var image interface{}
	if body.Image != nil && *body.Image != "" {
		image = *body.Image
	} else {
		image = nil
	}

	res, err := db.Exec(
		"INSERT INTO auctions (user_id, item, starting_price, image_url, end_time) VALUES (?, ?, ?, ?, ?)",
		s.UserID, body.Item, *body.StartingPrice, image, endTime,
	)
	if err != nil {
		log.Printf("error inserting auction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	auctionID, err := res.LastInsertId()
	if err != nil {
		log.Printf("error getting auction insert id: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"auctionId": auctionID})
}

func handleGetAuction(c *gin.Context) {
	id := c.Param("id")

	var (
		auctionID     int64
		item          string
		startingPrice float64
		imageURL      sql.NullString
		endTime       time.Time
	)

	err := db.QueryRow(
		"SELECT id, item, starting_price, image_url, end_time FROM auctions WHERE id = ?",
		id,
	).Scan(&auctionID, &item, &startingPrice, &imageURL, &endTime)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Auction not found"})
		return
	}
	if err != nil {
		log.Printf("error selecting auction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	var img *string
	if imageURL.Valid {
		img = &imageURL.String
	}

	c.JSON(http.StatusOK, gin.H{
		"id":            auctionID,
		"item":          item,
		"startingPrice": startingPrice,
		"imageUrl":      img,
		"endTime":       endTime.UTC().Format(time.RFC3339),
	})
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// CORS is already handled via headers, allow all origins here;
		// Gin CORS middleware ensures correct headers.
		return true
	},
}

func handleAuctionWebsocket(c *gin.Context) {
	// Path is /auction/:id, mirror Bun behavior checking prefix
	if !strings.HasPrefix(c.Request.URL.Path, "/auction/") {
		c.String(http.StatusNotFound, "Not Found")
		return
	}

	s := requireSession(c)
	if s == nil {
		return
	}

	auctionID := c.Param("id")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("websocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("WebSocket connected for auction %s", auctionID)
	for {
		mt, message, err := conn.ReadMessage()
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Printf("websocket read error for auction %s: %v", auctionID, err)
			}
			break
		}
		// Echo back same message (placeholder broadcasting).
		if err := conn.WriteMessage(mt, message); err != nil {
			log.Printf("websocket write error for auction %s: %v", auctionID, err)
			break
		}
	}
	log.Printf("WebSocket closed for auction %s", auctionID)
}

func main() {
	initDB()

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery(), corsMiddleware())

	r.POST("/register", handleRegister)
	r.POST("/login", handleLogin)
	r.GET("/dashboard", handleDashboard)
	r.POST("/create", handleCreateAuction)
	r.GET("/api/auction/:id", handleGetAuction)

	// WebSocket endpoint, mirrors /auction/:id upgrade behavior.
	r.GET("/auction/:id", handleAuctionWebsocket)

	portStr := getEnv("PORT", "3000")
	if _, err := strconv.Atoi(portStr); err != nil {
		log.Printf("invalid PORT %q, defaulting to 3000", portStr)
		portStr = "3000"
	}

	log.Printf("Auction backend (Go/Gin) running on http://localhost:%s", portStr)
	if err := r.Run(":" + portStr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

