package models

import "time"

type User struct {
	Id uint `gorm:"primaryKey;autoIncrement"`
	Email string `gorm:"not null"` 
	Password_hash string `gorm:"not null"`
	Created_at time.Time `gorm:"autoUpdateTime"`
}

func(User) TableName() string {
	return "users";
}