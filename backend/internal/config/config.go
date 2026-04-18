package config

import (
	"os"
	"strings"
	"time"
)

type Config struct {
	Port           string
	ServiceName    string
	Version        string
	Environment    string
	Region         string
	InstanceID     string
	Hostname       string
	AllowedOrigins []string
	StartTime      time.Time
}

func Load() Config {
	hostname, err := os.Hostname()
	if err != nil || strings.TrimSpace(hostname) == "" {
		hostname = "unknown-pod"
	}

	return Config{
		Port:           getEnv("PORT", "6543"),
		ServiceName:    getEnv("APP_NAME", "cloud-scaling-demo-api"),
		Version:        getEnv("APP_VERSION", "1.0.0"),
		Environment:    getEnv("APP_ENV", "development"),
		Region:         strings.TrimSpace(os.Getenv("APP_REGION")),
		InstanceID:     strings.TrimSpace(os.Getenv("APP_INSTANCE_ID")),
		Hostname:       hostname,
		AllowedOrigins: parseCSVEnv("ALLOWED_ORIGINS", "*"),
		StartTime:      time.Now().UTC(),
	}
}

func getEnv(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	return value
}

func parseCSVEnv(key string, fallback string) []string {
	value := getEnv(key, fallback)
	parts := strings.Split(value, ",")
	origins := make([]string, 0, len(parts))

	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}

	if len(origins) == 0 {
		return []string{"*"}
	}

	return origins
}
