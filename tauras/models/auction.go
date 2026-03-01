package models

import "time"


type Auction struct{
	Id uint `gorm:"primaryKey;autoIncrement"`
	User_id uint `gorm:"not null"`
	Item string `gorm:"not null"`
	Starting_price float64 `gorm:"type:decimal(10,2)"`
	Image_url string `gorm:"not null"`
	End_time time.Time `gorm:"not null"`
	current_price float32 `gorm:"type:decimal(10,2)"`
}

func (Auction) TableName() string {
	return "auctions";
}