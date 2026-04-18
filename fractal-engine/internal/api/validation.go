package api

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func parseMillisecondsQuery(c *gin.Context, key string, fallback int, min int, max int) (time.Duration, error) {
	rawValue := strings.TrimSpace(c.DefaultQuery(key, strconv.Itoa(fallback)))
	value, err := strconv.Atoi(rawValue)
	if err != nil {
		return 0, fmt.Errorf("%s must be a valid integer in milliseconds", key)
	}

	if value < min || value > max {
		return 0, fmt.Errorf("%s must be between %d and %d milliseconds", key, min, max)
	}

	return time.Duration(value) * time.Millisecond, nil
}

func parseIntensityQuery(c *gin.Context, fallback string) (string, error) {
	value := strings.ToLower(strings.TrimSpace(c.DefaultQuery("intensity", fallback)))
	switch value {
	case "low", "medium", "high":
		return value, nil
	default:
		return "", fmt.Errorf("intensity must be one of: low, medium, high")
	}
}
