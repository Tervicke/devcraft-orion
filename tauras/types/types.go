package types

import (
	"database/sql"
	"tauras/services"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

type AppContext struct {
	DB *sql.DB
	Session *services.SessionService
	KafkaProducer *kafka.Producer
}