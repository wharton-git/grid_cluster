package api

import (
	"context"
	"errors"
	"net/http"
	"os"
	"time"

	"fractal-engine/internal/config"
	"fractal-engine/internal/load"
	"fractal-engine/internal/metrics"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	cfg   config.Config
	store *metrics.Store
}

func NewHandler(cfg config.Config, store *metrics.Store) *Handler {
	return &Handler{
		cfg:   cfg,
		store: store,
	}
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"service":   h.cfg.ServiceName,
		"podName":   h.cfg.Hostname,
		"version":   h.cfg.Version,
		"timestamp": timestamp(),
	})
}

func (h *Handler) Ready(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":      "ready",
		"service":     h.cfg.ServiceName,
		"podName":     h.cfg.Hostname,
		"environment": h.cfg.Environment,
		"timestamp":   timestamp(),
	})
}

func (h *Handler) Info(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"hostname":    h.cfg.Hostname,
		"podName":     h.cfg.Hostname,
		"pid":         os.Getpid(),
		"timestamp":   timestamp(),
		"version":     h.cfg.Version,
		"uptime":      humanDuration(time.Since(h.cfg.StartTime)),
		"environment": h.cfg.Environment,
		"region":      emptyAsUnknown(h.cfg.Region),
		"instanceId":  emptyAsUnknown(h.cfg.InstanceID),
	})
}

func (h *Handler) Status(c *gin.Context) {
	snapshot := h.store.Snapshot()

	c.JSON(http.StatusOK, gin.H{
		"podName":               h.cfg.Hostname,
		"timestamp":             timestamp(),
		"requestCount":          snapshot.RequestCount,
		"averageResponseTimeMs": snapshot.AverageResponseMS,
		"errorCount":            snapshot.ErrorCount,
		"inFlightRequests":      snapshot.InFlightRequests,
		"uptime":                humanDuration(time.Since(snapshot.StartedAt)),
		"lastRequest": gin.H{
			"method":         snapshot.LastRequest.Method,
			"path":           snapshot.LastRequest.Path,
			"statusCode":     snapshot.LastRequest.StatusCode,
			"durationMs":     snapshot.LastRequest.Duration.Milliseconds(),
			"timestamp":      formatOptionalTime(snapshot.LastRequest.Timestamp),
			"hasRecentValue": !snapshot.LastRequest.Timestamp.IsZero(),
		},
	})
}

func (h *Handler) CPULoad(c *gin.Context) {
	duration, err := parseMillisecondsQuery(c, "duration", 5000, 250, 30000)
	if err != nil {
		writeValidationError(c, "duration", err.Error())
		return
	}

	intensity, err := parseIntensityQuery(c, "medium")
	if err != nil {
		writeValidationError(c, "intensity", err.Error())
		return
	}

	result, err := load.SimulateCPU(c.Request.Context(), duration, intensity)
	if err != nil && !errors.Is(err, context.Canceled) {
		writeInternalError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "completed",
		"type":      "cpu",
		"podName":   h.cfg.Hostname,
		"timestamp": timestamp(),
		"load":      result,
	})
}

func (h *Handler) LatencyLoad(c *gin.Context) {
	delay, err := parseMillisecondsQuery(c, "delay", 3000, 0, 30000)
	if err != nil {
		writeValidationError(c, "delay", err.Error())
		return
	}

	timer := time.NewTimer(delay)
	defer timer.Stop()

	select {
	case <-c.Request.Context().Done():
		writeCancelled(c)
		return
	case <-timer.C:
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "completed",
		"type":      "latency",
		"podName":   h.cfg.Hostname,
		"timestamp": timestamp(),
		"delayMs":   delay.Milliseconds(),
	})
}

func (h *Handler) MixedLoad(c *gin.Context) {
	duration, err := parseMillisecondsQuery(c, "duration", 4000, 250, 30000)
	if err != nil {
		writeValidationError(c, "duration", err.Error())
		return
	}

	delay, err := parseMillisecondsQuery(c, "delay", 1000, 0, 30000)
	if err != nil {
		writeValidationError(c, "delay", err.Error())
		return
	}

	intensity, err := parseIntensityQuery(c, "medium")
	if err != nil {
		writeValidationError(c, "intensity", err.Error())
		return
	}

	timer := time.NewTimer(delay)
	defer timer.Stop()

	select {
	case <-c.Request.Context().Done():
		writeCancelled(c)
		return
	case <-timer.C:
	}

	cpuResult, err := load.SimulateCPU(c.Request.Context(), duration, intensity)
	if err != nil && !errors.Is(err, context.Canceled) {
		writeInternalError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "completed",
		"type":      "mixed",
		"podName":   h.cfg.Hostname,
		"timestamp": timestamp(),
		"delayMs":   delay.Milliseconds(),
		"load":      cpuResult,
	})
}

func writeValidationError(c *gin.Context, field string, message string) {
	c.JSON(http.StatusBadRequest, gin.H{
		"error":     "invalid_query_parameter",
		"field":     field,
		"message":   message,
		"timestamp": timestamp(),
	})
}

func writeInternalError(c *gin.Context, err error) {
	c.JSON(http.StatusInternalServerError, gin.H{
		"error":     "internal_error",
		"message":   err.Error(),
		"timestamp": timestamp(),
	})
}

func writeCancelled(c *gin.Context) {
	c.JSON(http.StatusRequestTimeout, gin.H{
		"error":     "request_cancelled",
		"message":   "request was cancelled before completion",
		"timestamp": timestamp(),
	})
}

func timestamp() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}

func humanDuration(duration time.Duration) string {
	return duration.Round(time.Second).String()
}

func formatOptionalTime(value time.Time) any {
	if value.IsZero() {
		return nil
	}

	return value.UTC().Format(time.RFC3339Nano)
}

func emptyAsUnknown(value string) string {
	if value == "" {
		return "unknown"
	}

	return value
}
