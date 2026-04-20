package systemmetrics

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestV2ReaderUsesClosestAncestorForCPUQuota(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	procDir := filepath.Join(rootDir, "proc", "self")
	cgroupDir := filepath.Join(rootDir, "sys", "fs", "cgroup")

	mustWriteFile(t, filepath.Join(procDir, "cgroup"), "0::/parent/child/grandchild\n")
	mustWriteFile(t, filepath.Join(cgroupDir, "parent", "cpu.max"), "250000 100000\n")
	mustWriteFile(t, filepath.Join(cgroupDir, "parent", "child", "grandchild", "memory.current"), "123456\n")
	mustWriteFile(t, filepath.Join(cgroupDir, "parent", "child", "grandchild", "memory.max"), "max\n")
	mustWriteFile(t, filepath.Join(cgroupDir, "parent", "child", "grandchild", "cpu.stat"), "usage_usec 4200\n")

	reader := newCgroupReader(filepath.Join(rootDir, "proc"), cgroupDir)

	quota := reader.readCPUQuotaCores()
	if quota == nil || *quota != 2.5 {
		t.Fatalf("expected cpu quota 2.5, got %#v", quota)
	}

	current := reader.readMemoryCurrentBytes()
	if current == nil || *current != 123456 {
		t.Fatalf("expected memory current 123456, got %#v", current)
	}

	limit, unlimited := reader.readMemoryLimitBytes()
	if limit != nil || !unlimited {
		t.Fatalf("expected unlimited v2 memory, got limit=%#v unlimited=%v", limit, unlimited)
	}

	usage := reader.readCPUUsageNanoseconds()
	expectedUsage := uint64(4200) * uint64(time.Microsecond)
	if usage == nil || *usage != expectedUsage {
		t.Fatalf("expected cpu usage %d, got %#v", expectedUsage, usage)
	}
}

func TestV1ReaderReadsLegacyControllers(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	procDir := filepath.Join(rootDir, "proc", "self")
	cgroupDir := filepath.Join(rootDir, "sys", "fs", "cgroup")
	memoryMount := filepath.Join(cgroupDir, "memory")
	cpuMount := filepath.Join(cgroupDir, "cpu,cpuacct")

	mustWriteFile(t, filepath.Join(procDir, "cgroup"), "5:memory:/kubepods/pod-1\n4:cpu,cpuacct:/kubepods/pod-1\n")
	mustWriteFile(
		t,
		filepath.Join(procDir, "mountinfo"),
		fmt.Sprintf("24 23 0:29 / %s rw,relatime - cgroup cgroup rw,memory\n25 23 0:30 / %s rw,relatime - cgroup cgroup rw,cpu,cpuacct\n", memoryMount, cpuMount),
	)
	mustWriteFile(t, filepath.Join(cgroupDir, "memory", "kubepods", "pod-1", "memory.usage_in_bytes"), "2048\n")
	mustWriteFile(t, filepath.Join(cgroupDir, "memory", "kubepods", "pod-1", "memory.limit_in_bytes"), "9223372036854771712\n")
	mustWriteFile(t, filepath.Join(cgroupDir, "cpu,cpuacct", "kubepods", "pod-1", "cpu.cfs_quota_us"), "50000\n")
	mustWriteFile(t, filepath.Join(cgroupDir, "cpu,cpuacct", "kubepods", "pod-1", "cpu.cfs_period_us"), "100000\n")
	mustWriteFile(t, filepath.Join(cgroupDir, "cpu,cpuacct", "kubepods", "pod-1", "cpuacct.usage"), "333\n")

	reader := newCgroupReader(filepath.Join(rootDir, "proc"), cgroupDir)

	current := reader.readMemoryCurrentBytes()
	if current == nil || *current != 2048 {
		t.Fatalf("expected memory current 2048, got %#v", current)
	}

	limit, unlimited := reader.readMemoryLimitBytes()
	if limit != nil || !unlimited {
		t.Fatalf("expected unlimited v1 memory, got limit=%#v unlimited=%v", limit, unlimited)
	}

	quota := reader.readCPUQuotaCores()
	if quota == nil || *quota != 0.5 {
		t.Fatalf("expected cpu quota 0.5, got %#v", quota)
	}

	usage := reader.readCPUUsageNanoseconds()
	if usage == nil || *usage != 333 {
		t.Fatalf("expected cpu usage 333, got %#v", usage)
	}
}

func TestCollectorSamplesCPUUsagePercent(t *testing.T) {
	t.Parallel()

	collector := &Collector{}
	startedAt := time.Unix(0, 0)

	first := collector.sampleCPUUsage(startedAt, ptrUint64(0), ptrFloat64(2), 2, 2)
	if first != nil {
		t.Fatalf("expected first sample to be nil, got %#v", first)
	}

	second := collector.sampleCPUUsage(
		startedAt.Add(2*time.Second),
		ptrUint64(2_000_000_000),
		ptrFloat64(2),
		2,
		2,
	)
	if second == nil {
		t.Fatal("expected cpu usage percent on second sample")
	}

	if *second != 50 {
		t.Fatalf("expected cpu usage percent 50, got %v", *second)
	}
}

func TestParseNetworkTotals(t *testing.T) {
	t.Parallel()

	rxTotal, txTotal := parseNetworkTotals([]byte(`Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 1024 10 0 0 0 0 0 0 2048 20 0 0 0 0 0 0
  eth0: 8192 80 0 0 0 0 0 0 4096 40 0 0 0 0 0 0
`))
	if rxTotal == nil || *rxTotal != 9216 {
		t.Fatalf("expected rx total 9216, got %#v", rxTotal)
	}

	if txTotal == nil || *txTotal != 6144 {
		t.Fatalf("expected tx total 6144, got %#v", txTotal)
	}
}

func TestCollectorSamplesNetworkUsage(t *testing.T) {
	t.Parallel()

	collector := &Collector{}
	startedAt := time.Unix(0, 0)

	firstRx, firstTx := collector.sampleNetworkUsage(startedAt, ptrUint64(100), ptrUint64(200))
	if firstRx != nil || firstTx != nil {
		t.Fatalf("expected first network sample to be nil, got rx=%#v tx=%#v", firstRx, firstTx)
	}

	secondRx, secondTx := collector.sampleNetworkUsage(
		startedAt.Add(2*time.Second),
		ptrUint64(2_100),
		ptrUint64(4_200),
	)
	if secondRx == nil || secondTx == nil {
		t.Fatal("expected network rate sample on second measurement")
	}

	if *secondRx != 1000 {
		t.Fatalf("expected rx rate 1000 B/s, got %v", *secondRx)
	}

	if *secondTx != 2000 {
		t.Fatalf("expected tx rate 2000 B/s, got %v", *secondTx)
	}
}

func mustWriteFile(t *testing.T, path string, content string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", path, err)
	}

	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}
