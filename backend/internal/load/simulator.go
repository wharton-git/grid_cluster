package load

import (
	"context"
	"errors"
	"math"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

var ErrInvalidIntensity = errors.New("invalid intensity")

type profile struct {
	workers   func(int) int
	innerLoop int
}

type Result struct {
	DurationMS     int    `json:"durationMs"`
	Intensity      string `json:"intensity"`
	Workers        int    `json:"workers"`
	OperationCount int64  `json:"operationCount"`
}

var profiles = map[string]profile{
	"low": {
		workers: func(base int) int {
			if base < 2 {
				return 1
			}
			return max(1, base/2)
		},
		innerLoop: 4000,
	},
	"medium": {
		workers: func(base int) int {
			return max(1, base)
		},
		innerLoop: 9000,
	},
	"high": {
		workers: func(base int) int {
			return max(2, base*2)
		},
		innerLoop: 18000,
	},
}

func SimulateCPU(ctx context.Context, duration time.Duration, intensity string) (Result, error) {
	profile, ok := profiles[intensity]
	if !ok {
		return Result{}, ErrInvalidIntensity
	}

	workers := profile.workers(runtime.GOMAXPROCS(0))
	deadline := time.Now().Add(duration)

	var totalOperations atomic.Int64
	var wg sync.WaitGroup

	for i := 0; i < workers; i++ {
		wg.Add(1)

		go func(seed float64) {
			defer wg.Done()

			accumulator := seed + 0.5
			localOperations := int64(0)

			for time.Now().Before(deadline) {
				select {
				case <-ctx.Done():
					totalOperations.Add(localOperations)
					return
				default:
				}

				for j := 1; j <= profile.innerLoop; j++ {
					accumulator += math.Sqrt(float64(j)+accumulator) * math.Sin(accumulator)
					if accumulator > 10_000 || accumulator < -10_000 {
						accumulator = math.Mod(accumulator, 113) + 1
					}
				}

				localOperations += int64(profile.innerLoop)
			}

			totalOperations.Add(localOperations)
		}(float64(i + 1))
	}

	wg.Wait()

	result := Result{
		DurationMS:     int(duration.Milliseconds()),
		Intensity:      intensity,
		Workers:        workers,
		OperationCount: totalOperations.Load(),
	}

	if err := ctx.Err(); err != nil {
		return result, err
	}

	return result, nil
}
