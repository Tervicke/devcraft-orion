-- Database and schema for the live auction app

CREATE DATABASE IF NOT EXISTS auc;
USE auc;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auctions table for created auctions
CREATE TABLE IF NOT EXISTS auctions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item VARCHAR(255) NOT NULL,
  starting_price DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(255),
  end_time DATETIME NOT NULL
);

