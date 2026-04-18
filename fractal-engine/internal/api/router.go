package api

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"fractal-engine/internal/config"
	"fractal-engine/internal/metrics"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func NewRouter(cfg config.Config, store *metrics.Store, logger *slog.Logger) *gin.Engine {
	if strings.EqualFold(cfg.Environment, "development") {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	_ = router.SetTrustedProxies(nil)

	router.Use(requestMiddleware(cfg, store, logger))
	router.Use(gin.Recovery())
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{http.MethodGet, http.MethodOptions},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"X-Pod-Name", "X-App-Version", "X-Request-ID"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	handler := NewHandler(cfg, store)

	api := router.Group("/api")
	{
		api.GET("/health", handler.Health)
		api.GET("/ready", handler.Ready)
		api.GET("/info", handler.Info)
		api.GET("/status", handler.Status)
		api.GET("/load/cpu", handler.CPULoad)
		api.GET("/load/latency", handler.LatencyLoad)
		api.GET("/load/mixed", handler.MixedLoad)
	}

	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service":   cfg.ServiceName,
			"version":   cfg.Version,
			"timestamp": timestamp(),
			"message":   "Cloud Scaling Demo backend is running.",
		})
	})

	return router
}
