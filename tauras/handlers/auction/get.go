package auction

import (
	"database/sql"
	"log"
	t "tauras/types"
	"time"

	"github.com/gin-gonic/gin"
)
func HandleGetAuction(c *gin.Context , ctx *t.AppContext) {
	id := c.Param("id")
	db := ctx.DB
	var (
		auctionID     int64
		item          string
		startingPrice float64
		currentPrice  float64
		imageURL      sql.NullString
		endTime       time.Time
	)

	err := db.QueryRow(
		`SELECT a.id, a.item, a.starting_price,
		 COALESCE((SELECT MAX(b.price) FROM bids b WHERE b.auction_id = a.id), a.starting_price),
		 a.image_url, a.end_time
		 FROM auctions a WHERE a.id = ?`,
		id,
	).Scan(&auctionID, &item, &startingPrice, &currentPrice, &imageURL, &endTime)
	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"error": "Auction not found"})
		return
	}
	if err != nil {
		log.Printf("error selecting auction: %v", err)
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	var img *string
	if imageURL.Valid {
		img = &imageURL.String
	}

	c.JSON(200, gin.H{
		"id":            auctionID,
		"item":          item,
		"startingPrice": startingPrice,
		"currentPrice":  currentPrice,
		"imageUrl":      img,
		"endTime":       endTime.UTC().Format(time.RFC3339),
	})
}