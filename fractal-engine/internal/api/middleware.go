package api

import (
	"log/slog"
	"time"

	"fractal-engine/internal/config"
	"fractal-engine/internal/metrics"

	"github.com/gin-gonic/gin"
)

func requestMiddleware(cfg config.Config, store *metrics.Store, logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		startedAt := time.Now()
		requestID := store.NextRequestID()

		store.RequestStarted()
		c.Header("X-Pod-Name", cfg.Hostname)
		c.Header("X-App-Version", cfg.Version)
		c.Header("X-Request-ID", requestID)
		c.Set("requestID", requestID)

		c.Next()

		duration := time.Since(startedAt)
		route := c.FullPath()
		if route == "" {
			route = c.Request.URL.Path
		}

		store.RequestCompleted(c.Request.Method, route, c.Writer.Status(), duration)

		logger.Info("request completed",
			"request_id", requestID,
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"route", route,
			"status", c.Writer.Status(),
			"duration_ms", duration.Milliseconds(),
			"pod", cfg.Hostname,
			"client_ip", c.ClientIP(),
		)
	}
}
