package models

import "time"

type Bid struct {
	Id         uint64 `gorm:"primaryKey;autoIncrement"`
	Auction_id uint64 	`gorm:"not null"`
	User_id    uint `gorm:"not null"`
	Price      float64 `gorm:"type:decimal(10,2)"`
	Updated_at time.Time `gorm:"autoUpdateTime"`
}

func (Bid) TableName() string {
	return "bids";
}