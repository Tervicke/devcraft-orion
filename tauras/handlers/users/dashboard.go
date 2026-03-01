package users

import (
	t "tauras/types"

	"github.com/gin-gonic/gin"
)

func HandleDashboard(c *gin.Context , ctx *t.AppContext ){
	s := ctx.Session.RequireSession(c)
	if s == nil {
		return
	}
	c.JSON(200, gin.H{
		"message": "Dashboard data placeholder",
		"userId":  s.UserID,
	})
}