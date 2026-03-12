package users

import (
	"database/sql"
	"log"
	t "tauras/types"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)
func HandleRegister(c *gin.Context , ctx *t.AppContext) {
	authDB := ctx.DB
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Email == "" || body.Password == "" {
		c.JSON(400, gin.H{"error": "Email and password are required"})
		return
	}

	var existingID int64
	err := authDB.QueryRow("SELECT id FROM users WHERE email = ? LIMIT 1", body.Email).Scan(&existingID)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("error checking existing user: %v", err)
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}
	if err == nil {
		c.JSON(409, gin.H{"error": "User with this email already exists"})
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 10)
	if err != nil {
		log.Printf("error hashing password: %v", err)
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	res, err := authDB.Exec("INSERT INTO users (email, password_hash) VALUES (?, ?)", body.Email, string(passwordHash))
	if err != nil {
		log.Printf("error inserting user: %v", err)
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	userID, err := res.LastInsertId()
	if err != nil {
		log.Printf("error getting insert id: %v", err)
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	token := ctx.Session.CreateSession(uint64(userID))
	ctx.Session.SetSessionCookie(c, token)
	c.JSON(201, gin.H{"id": userID, "email": body.Email})
}
