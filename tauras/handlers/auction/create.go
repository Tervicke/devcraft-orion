package auction

import (
	"fmt"
	"log"
	"tauras/models"
	t "tauras/types"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func HandleCreateAuction(c *gin.Context , ctx *t.AppContext) {
	s := ctx.Session.RequireSession(c)
	db := ctx.Gdb;

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
		c.JSON(400, gin.H{"error": "Item, starting price, and end time are required"})
		return
	}

	fmt.Println("##########################",s.UserID)
	fmt.Println("Received cte auction request: \n", body);

	// Treat all end times as IST (Asia/Kolkata) local time.
	loc, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		log.Printf("error loading IST location: %v", err)
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	layout := "2006-01-02T15:04"
	endTime, err := time.ParseInLocation(layout, body.EndTime, loc)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid end time"})
		return
	}

	var image interface{}
	if body.Image != nil && *body.Image != "" {
		image = *body.Image
	} else {
		image = nil
	}
	//use a gorm transaction to ensure both auction and initial bid are created together
	fmt.Println("##########################",s.UserID)
	fmt.Println("heloooooooooooooooooooooooooooooooooo ")
	auction := models.Auction{
		Id:            0, // this will be set by the database
		User_id: 	  s.UserID,
		Item: 		body.Item,
		Starting_price: *body.StartingPrice,
		Image_url: image.(string),
		End_time: endTime,
		Current_price: *body.StartingPrice,
	}

	bid := models.Bid{
		Id: 	  0, // this will be set by the database
		Auction_id: auction.Id,
		User_id:    s.UserID,
		Price:     auction.Current_price,
		Updated_at: time.Now(),
	}

	err = db.Transaction(func(tx *gorm.DB) error {

		if err := tx.Create(&auction).Error; err != nil {
			return err //rollback will be automatic if error is returned
		}
		
		if err := tx.Create(&bid).Error; err != nil {
			return err //rollback will be automatic if error is returned
		}

		return nil
	}) 

	//use a transaction to ensure both auction and initial bid are created together
	/*
	tx, err := db.Begin()
	if err != nil {
		log.Printf("error starting transaction: %v", err)
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	res, err := tx.Exec(
		"INSERT INTO auctions (user_id, item, starting_price, image_url, end_time , current_price) VALUES (?, ?, ?, ?, ? , ?)",
		s.UserID, body.Item, *body.StartingPrice, image, endTime, *body.StartingPrice,
	)
	if err != nil {
		tx.Rollback()
		log.Printf("error inserting auction: %v", err)
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	auctionID, err := res.LastInsertId()
	if err != nil {
		tx.Rollback()
		log.Printf("error getting auction insert id: %v", err)
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	_, err = tx.Exec(
		"INSERT INTO bids (auction_id, user_id, price) VALUES (?, ?, ?)",
		auctionID,
		s.UserID,
		*body.StartingPrice,
	)
	if err != nil {
		tx.Rollback()
		log.Printf("error inserting initial bid: %v", err)
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("error committing transaction: %v", err)
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}
	*/

	c.JSON(201, gin.H{"auctionId": auction.Id})

}