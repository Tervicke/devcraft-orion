package users

import (
	"database/sql"
	"log"
	t "tauras/types"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func HandleLogin(c *gin.Context , ctx *t.AppContext) {
	authDB := ctx.DB

	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Email == "" || body.Password == "" {
		c.JSON(400, gin.H{"error": "Email and password are required"})
		return
	}

	var (
		userID       uint64
		passwordHash string
	)
	err := authDB.QueryRow("SELECT id, password_hash FROM users WHERE email = ? LIMIT 1", body.Email).Scan(&userID, &passwordHash)
	if err == sql.ErrNoRows {
		c.JSON(401, gin.H{"error": "Invalid email or password"})
		return
	}
	if err != nil {
		log.Printf("error selecting user: %v", err)
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(body.Password)); err != nil {
		c.JSON(401, gin.H{"error": "Invalid email or password"})
		return
	}

	token := ctx.Session.CreateSession(userID)
	ctx.Session.SetSessionCookie(c, token)
	c.JSON(200, gin.H{"id": userID, "email": body.Email})
}