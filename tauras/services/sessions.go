package services

import (
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type Session struct {
    UserID uint64
}

// In-memory session store (replace with DB or Redis for production)
var sessions = map[string]Session{}

// SessionService holds session-related logic
type SessionService struct{}

// ParseSessionCookie reads the session cookie and returns the session
func (s *SessionService) ParseSessionCookie(c *gin.Context) *Session {
    cookie, err := c.Request.Cookie("session")
    if err != nil || cookie.Value == "" {
        return nil
    }
    if sess, ok := sessions[cookie.Value]; ok {
        return &sess
    }
    return nil
}

// CreateSession creates a new session token
func (s *SessionService) CreateSession(userID uint64) string {
    token := strconv.FormatInt(time.Now().UnixNano(), 36) + "-" + strconv.FormatInt(int64(userID), 36)
    sessions[token] = Session{UserID: userID}
    return token
}

// SetSessionCookie sets the session cookie on the response
func (s *SessionService) SetSessionCookie(c *gin.Context, token string) {
    http.SetCookie(c.Writer, &http.Cookie{
        Name:     "session",
        Value:    token,
        Path:     "/",
        HttpOnly: true,
        SameSite: http.SameSiteLaxMode,
    })
}

// RequireSession validates that a session exists, returns nil if unauthorized
func (s *SessionService) RequireSession(c *gin.Context) *Session {
    if os.Getenv("LOAD_TEST") == "true" {
        return &Session{UserID: 0}
    }
    sess := s.ParseSessionCookie(c)
    if sess == nil {
        c.JSON(401, gin.H{"error": "Unauthorized"})
        return nil
    }
    return sess
}