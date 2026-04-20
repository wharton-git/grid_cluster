package api

import (
	"log/slog"
	"time"

	"fractal-engine/internal/config"
	"fractal-engine/internal/metrics"

	"github.com/gin-gonic/gin"
)

var untrackedMetricsRoutes = map[string]struct{}{
	"/api/health": {},
	"/api/ready":  {},
	"/api/info":   {},
	"/api/status": {},
}

func shouldTrackRequestMetrics(path string) bool {
	_, excluded := untrackedMetricsRoutes[path]
	return !excluded
}

func requestMiddleware(cfg config.Config, store *metrics.Store, logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		startedAt := time.Now()
		requestID := store.NextRequestID()
		requestPath := c.Request.URL.Path
		trackMetrics := shouldTrackRequestMetrics(requestPath)

		if trackMetrics {
			store.RequestStarted()
		}
		c.Header("X-Pod-Name", cfg.Hostname)
		c.Header("X-App-Version", cfg.Version)
		c.Header("X-Request-ID", requestID)
		c.Set("requestID", requestID)

		c.Next()

		duration := time.Since(startedAt)
		route := c.FullPath()
		if route == "" {
			route = requestPath
		}

		if trackMetrics {
			store.RequestCompleted(c.Request.Method, route, c.Writer.Status(), duration)
		}

		logger.Info("request completed",
			"request_id", requestID,
			"method", c.Request.Method,
			"path", requestPath,
			"route", route,
			"status", c.Writer.Status(),
			"duration_ms", duration.Milliseconds(),
			"pod", cfg.Hostname,
			"client_ip", c.ClientIP(),
		)
	}
}
