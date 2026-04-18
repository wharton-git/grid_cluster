package metrics

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

type LastRequest struct {
	Method     string
	Path       string
	StatusCode int
	Duration   time.Duration
	Timestamp  time.Time
}

type Snapshot struct {
	StartedAt         time.Time
	RequestCount      uint64
	ErrorCount        uint64
	AverageResponseMS float64
	InFlightRequests  int64
	LastRequest       LastRequest
}

type Store struct {
	startedAt       time.Time
	requestSequence atomic.Uint64
	requestCount    atomic.Uint64
	errorCount      atomic.Uint64
	totalDurationNS atomic.Int64
	inFlight        atomic.Int64

	mu          sync.RWMutex
	lastRequest LastRequest
}

func NewStore(startedAt time.Time) *Store {
	return &Store{startedAt: startedAt}
}

func (s *Store) NextRequestID() string {
	sequence := s.requestSequence.Add(1)
	return fmt.Sprintf("req-%06d", sequence)
}

func (s *Store) RequestStarted() {
	s.inFlight.Add(1)
}

func (s *Store) RequestCompleted(method string, path string, statusCode int, duration time.Duration) {
	s.inFlight.Add(-1)
	s.requestCount.Add(1)
	s.totalDurationNS.Add(duration.Nanoseconds())

	if statusCode >= 400 {
		s.errorCount.Add(1)
	}

	s.mu.Lock()
	s.lastRequest = LastRequest{
		Method:     method,
		Path:       path,
		StatusCode: statusCode,
		Duration:   duration,
		Timestamp:  time.Now().UTC(),
	}
	s.mu.Unlock()
}

func (s *Store) Snapshot() Snapshot {
	requestCount := s.requestCount.Load()
	totalDuration := s.totalDurationNS.Load()
	averageResponseMS := 0.0

	if requestCount > 0 {
		averageResponseMS = float64(totalDuration) / float64(requestCount) / float64(time.Millisecond)
	}

	s.mu.RLock()
	lastRequest := s.lastRequest
	s.mu.RUnlock()

	return Snapshot{
		StartedAt:         s.startedAt,
		RequestCount:      requestCount,
		ErrorCount:        s.errorCount.Load(),
		AverageResponseMS: averageResponseMS,
		InFlightRequests:  s.inFlight.Load(),
		LastRequest:       lastRequest,
	}
}
