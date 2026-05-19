package config

import (
	"os"
	"strings"
)

type Config struct {
	AppEnv           string
	Port             string
	DatabaseURL      string
	CORSAllowOrigins []string
}

func Load() Config {
	return Config{
		AppEnv:           getEnv("APP_ENV", "development"),
		Port:             getEnv("PORT", "8080"),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://nexttask:nexttask@localhost:5432/nexttask?sslmode=disable"),
		CORSAllowOrigins: splitCSV(getEnv("CORS_ALLOW_ORIGINS", "http://localhost:3000")),
	}
}

func getEnv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if item := strings.TrimSpace(part); item != "" {
			out = append(out, item)
		}
	}
	return out
}
