package routes

import (
	"fmt"
	"tauras/handlers/auction"
	"tauras/handlers/users"
	t "tauras/types"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine , ctx *t.AppContext){
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, "pong");
	});
	
	userGroup := r.Group("api/user")
	{
		userGroup.POST("/register", func(c *gin.Context) {
			users.HandleRegister(c , ctx)
		});
		userGroup.POST("/login", func(c *gin.Context) {
			users.HandleLogin(c, ctx)
		} )
		userGroup.GET("/dashboard", func(c *gin.Context) {
			users.HandleDashboard(c, ctx)
		})
	};

	auctionGroup := r.Group("api/auction/")
	{

		auctionGroup.POST("/bid", func(c *gin.Context) {
			fmt.Println("Received bid request");
			auction.BidHandler(c, ctx);
		});

		auctionGroup.POST("/create", func(c *gin.Context){
			auction.HandleCreateAuction(c, ctx)
		});
		auctionGroup.GET("/:id", func(c *gin.Context) {
			auction.HandleGetAuction(c , ctx)
		});
	};

	// later implementations 
	// r.GET("/api/auction/:id/bids", handleGetAuctionBids)
	// r.GET("/auction/:id", handleAuctionWebsocket)
}
