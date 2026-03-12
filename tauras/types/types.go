package types

import (
	"database/sql"
	"tauras/services"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"gorm.io/gorm"
)

type AppContext struct {
	DB *sql.DB
	Session *services.SessionService
	KafkaProducer *kafka.Producer
	Gdb *gorm.DB
}