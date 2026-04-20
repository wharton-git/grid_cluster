package api

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"fractal-engine/internal/config"
	"fractal-engine/internal/metrics"

	"github.com/gin-gonic/gin"
)

func TestShouldTrackRequestMetrics(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		path    string
		tracked bool
	}{
		{path: "/api/health", tracked: false},
		{path: "/api/ready", tracked: false},
		{path: "/api/info", tracked: false},
		{path: "/api/status", tracked: false},
		{path: "/api/load/cpu", tracked: true},
		{path: "/api/load/latency", tracked: true},
		{path: "/", tracked: true},
	}

	for _, testCase := range testCases {
		testCase := testCase

		t.Run(testCase.path, func(t *testing.T) {
			t.Parallel()

			if tracked := shouldTrackRequestMetrics(testCase.path); tracked != testCase.tracked {
				t.Fatalf("shouldTrackRequestMetrics(%q) = %t, want %t", testCase.path, tracked, testCase.tracked)
			}
		})
	}
}

func TestRequestMiddlewareExcludesObservabilityRoutesFromMetrics(t *testing.T) {
	gin.SetMode(gin.TestMode)

	store := metrics.NewStore(time.Now().UTC())
	cfg := config.Config{
		Hostname:    "pod-test",
		Version:     "1.0.0",
		ServiceName: "demo-api",
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	router := gin.New()
	router.Use(requestMiddleware(cfg, store, logger))
	router.GET("/api/load/cpu", func(c *gin.Context) {
		c.JSON(http.StatusAccepted, gin.H{"status": "accepted"})
	})
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	router.GET("/api/status", func(c *gin.Context) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "down"})
	})

	firstResponse := httptest.NewRecorder()
	router.ServeHTTP(firstResponse, httptest.NewRequest(http.MethodGet, "/api/load/cpu", nil))

	if firstResponse.Code != http.StatusAccepted {
		t.Fatalf("unexpected status for tracked route: got %d want %d", firstResponse.Code, http.StatusAccepted)
	}

	secondResponse := httptest.NewRecorder()
	router.ServeHTTP(secondResponse, httptest.NewRequest(http.MethodGet, "/api/health", nil))

	if secondResponse.Code != http.StatusOK {
		t.Fatalf("unexpected status for /api/health: got %d want %d", secondResponse.Code, http.StatusOK)
	}

	thirdResponse := httptest.NewRecorder()
	router.ServeHTTP(thirdResponse, httptest.NewRequest(http.MethodGet, "/api/status", nil))

	if thirdResponse.Code != http.StatusServiceUnavailable {
		t.Fatalf("unexpected status for /api/status: got %d want %d", thirdResponse.Code, http.StatusServiceUnavailable)
	}

	snapshot := store.Snapshot()

	if snapshot.RequestCount != 1 {
		t.Fatalf("unexpected request count: got %d want 1", snapshot.RequestCount)
	}

	if snapshot.ErrorCount != 0 {
		t.Fatalf("unexpected error count: got %d want 0", snapshot.ErrorCount)
	}

	if snapshot.LastRequest.Path != "/api/load/cpu" {
		t.Fatalf("unexpected last request path: got %q want %q", snapshot.LastRequest.Path, "/api/load/cpu")
	}

	if snapshot.InFlightRequests != 0 {
		t.Fatalf("unexpected in-flight requests: got %d want 0", snapshot.InFlightRequests)
	}

	if firstResponse.Header().Get("X-Request-ID") == "" {
		t.Fatal("missing X-Request-ID header on tracked route")
	}

	if secondResponse.Header().Get("X-Request-ID") == "" {
		t.Fatal("missing X-Request-ID header on untracked route")
	}
}
