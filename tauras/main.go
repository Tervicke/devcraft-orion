package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"tauras/models"
	"tauras/routes"
	"tauras/services"
	"tauras/types"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)
func migrate() error {
	if err := godotenv.Load(); err != nil {
		log.Println(".env not found, using system environment variables")
	}
	dsn := os.Getenv("DB_DSN")
	fmt.Println("Running migrations with DSN: ", dsn)
	gormDb , err := gorm.Open(mysql.Open(dsn), &gorm.Config{}) ;
	if err != nil {
		return err
	}
	//auto migrate the auction
	return gormDb.AutoMigrate(
		&models.Auction{},
		&models.Bid{},
		&models.User{},
	)
}

func setupDb() (*sql.DB, error) {
	if err := godotenv.Load(); err != nil {
		log.Println(".env not found, using system environment variables")
	}

	dsn := os.Getenv("DB_DSN")
	if dsn == "" {
		return nil, fmt.Errorf("DB_DSN is not set")
	}
	db , err := sql.Open("mysql", dsn);
	if err != nil {
		return nil , err;
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(time.Hour)
	ctx , cancel := context.WithTimeout(context.Background(), 5*time.Second);
	defer cancel();
	if err := db.PingContext(ctx); err != nil {
		return nil , err;
	}
	return db , nil;
}


func setupKafkaProducer() (*kafka.Producer, error) {
	if err := godotenv.Load(); err != nil {
		log.Println(".env not found, using system environment variables")
	}

	kafka_broker := os.Getenv("KAFKA_BROKERS")
	fmt.Println("Setting up Kafka producer with brokers: ", kafka_broker)
	if kafka_broker == "" {
		return nil, fmt.Errorf("kafka brokers are not set in KAFKA_BROKERS")
	}
	p , err := kafka.NewProducer(&kafka.ConfigMap{"bootstrap.servers": kafka_broker})
	if err != nil {
		return nil , err;
	}
	go func() {
		for e := range p.Events() {
			switch ev := e.(type) {
			case *kafka.Message:
				if ev.TopicPartition.Error != nil {
					fmt.Println("Delivery failed:", ev.TopicPartition)
				} else {
					fmt.Println("Delivered to", ev.TopicPartition)
				}
			}
		}
	}()
	return p , nil;
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func frontendOrigin() string {
	return getEnv("FRONTEND_ORIGIN", "http://localhost:5173")
}

// corsMiddleware replicates the Bun CORS behavior for auth/auction routes.
func corsMiddleware() gin.HandlerFunc {
	origin := frontendOrigin()
	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("Access-Control-Allow-Origin", origin)
		h.Set("Access-Control-Allow-Credentials", "true")
		h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		h.Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

		if c.Request.Method == http.MethodOptions {
			c.Status(http.StatusNoContent)
			c.Abort()
			return
		}

		c.Next()
	}
}

func main(){

	//Run Migrations	
	/*
	if err := migrate(); err != nil {
		log.Fatalf("Failed to run migrations: ", err)
		return;
	}
	*/

	log.Println("Database migrations completed successfully");

	db , err := setupDb()
	if err != nil {
		fmt.Println("Failed to connect to database: ", err);
		panic(err);
	}

	log.Println("Successfully connected to database");

	//set up the kafka producer
	p , err := setupKafkaProducer();

	if err != nil {
		fmt.Println("Failed to set up Kafka producer: ", err);
		panic(err);
	}

	defer p.Close();
	log.Println("Successfully set up Kafka producer");
	
	ctx := &types.AppContext{
		DB: db , //the db connection
		Session: &services.SessionService{}, //the session service
		KafkaProducer: p, //the kafka producer
	};

	r := gin.Default();

	//only allow localhost:5173 cors and include allow creditinals
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	routes.SetupRoutes(r , ctx);
	r.Run(":3000");
}
