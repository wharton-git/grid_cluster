package systemmetrics

import (
	"bufio"
	"bytes"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

const unlimitedV1MemoryThreshold = 1 << 60

type ResourceSnapshot struct {
	CPULogicalCores          int      `json:"cpuLogicalCores"`
	GOMAXPROCS               int      `json:"goMaxProcs"`
	CPUQuotaCores            *float64 `json:"cpuQuotaCores,omitempty"`
	CPUUsageApproxPercent    *float64 `json:"cpuUsageApproxPercent,omitempty"`
	NetworkRxBytesTotal      *uint64  `json:"networkRxBytesTotal,omitempty"`
	NetworkTxBytesTotal      *uint64  `json:"networkTxBytesTotal,omitempty"`
	NetworkRxBytesPerSecond  *float64 `json:"networkRxBytesPerSecond,omitempty"`
	NetworkTxBytesPerSecond  *float64 `json:"networkTxBytesPerSecond,omitempty"`
	MemoryGoAllocBytes       uint64   `json:"memoryGoAllocBytes"`
	MemoryGoSysBytes         uint64   `json:"memoryGoSysBytes"`
	MemoryCgroupCurrentBytes *uint64  `json:"memoryCgroupCurrentBytes,omitempty"`
	MemoryCgroupLimitBytes   *uint64  `json:"memoryCgroupLimitBytes,omitempty"`
	MemoryLimitUnlimited     bool     `json:"memoryCgroupLimitUnlimited,omitempty"`
	Goroutines               int      `json:"goroutines"`
	Timestamp                string   `json:"timestamp"`
}

type Collector struct {
	mu            sync.Mutex
	now           func() time.Time
	cgroup        cgroupReader
	lastCPUSample cpuUsageSample
	lastNetSample networkUsageSample
}

type cpuUsageSample struct {
	measuredAt time.Time
	usageNS    uint64
}

type networkUsageSample struct {
	measuredAt time.Time
	rxBytes    uint64
	txBytes    uint64
}

func NewCollector() *Collector {
	return &Collector{
		now:    time.Now,
		cgroup: newCgroupReader("/proc", "/sys/fs/cgroup"),
	}
}

func (c *Collector) Snapshot() ResourceSnapshot {
	return c.snapshot(true)
}

func (c *Collector) SnapshotStatic() ResourceSnapshot {
	return c.snapshot(false)
}

func (c *Collector) snapshot(includeCPUUsage bool) ResourceSnapshot {
	now := c.now().UTC()

	snapshot := ResourceSnapshot{
		CPULogicalCores: runtime.NumCPU(),
		GOMAXPROCS:      runtime.GOMAXPROCS(0),
		Goroutines:      runtime.NumGoroutine(),
		Timestamp:       now.Format(time.RFC3339Nano),
	}

	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	snapshot.MemoryGoAllocBytes = memStats.Alloc
	snapshot.MemoryGoSysBytes = memStats.Sys

	memoryCurrent := c.cgroup.readMemoryCurrentBytes()
	memoryLimit, memoryUnlimited := c.cgroup.readMemoryLimitBytes()
	cpuQuota := c.cgroup.readCPUQuotaCores()
	cpuUsageNS := c.cgroup.readCPUUsageNanoseconds()
	networkRxBytes, networkTxBytes := readNetworkTotalsBytes(c.cgroup.procRoot)

	snapshot.MemoryCgroupCurrentBytes = memoryCurrent
	snapshot.MemoryCgroupLimitBytes = memoryLimit
	snapshot.MemoryLimitUnlimited = memoryUnlimited
	snapshot.CPUQuotaCores = cpuQuota
	snapshot.NetworkRxBytesTotal = networkRxBytes
	snapshot.NetworkTxBytesTotal = networkTxBytes
	if includeCPUUsage {
		snapshot.CPUUsageApproxPercent = c.sampleCPUUsage(
			now,
			cpuUsageNS,
			cpuQuota,
			snapshot.GOMAXPROCS,
			snapshot.CPULogicalCores,
		)
		snapshot.NetworkRxBytesPerSecond, snapshot.NetworkTxBytesPerSecond = c.sampleNetworkUsage(
			now,
			networkRxBytes,
			networkTxBytes,
		)
	}

	return snapshot
}

func (c *Collector) sampleCPUUsage(
	now time.Time,
	usageNS *uint64,
	cpuQuotaCores *float64,
	goMaxProcs int,
	cpuLogicalCores int,
) *float64 {
	if usageNS == nil {
		return nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	previous := c.lastCPUSample
	c.lastCPUSample = cpuUsageSample{
		measuredAt: now,
		usageNS:    *usageNS,
	}

	if previous.measuredAt.IsZero() || *usageNS < previous.usageNS {
		return nil
	}

	elapsedNS := now.Sub(previous.measuredAt).Nanoseconds()
	if elapsedNS <= 0 {
		return nil
	}

	availableCores := resolveAvailableCores(cpuQuotaCores, goMaxProcs, cpuLogicalCores)
	if availableCores <= 0 {
		return nil
	}

	deltaUsageNS := *usageNS - previous.usageNS
	usagePercent := (float64(deltaUsageNS) / float64(elapsedNS) / availableCores) * 100
	if usagePercent < 0 {
		return nil
	}

	return ptrFloat64(usagePercent)
}

func (c *Collector) sampleNetworkUsage(
	now time.Time,
	rxBytes *uint64,
	txBytes *uint64,
) (*float64, *float64) {
	if rxBytes == nil || txBytes == nil {
		return nil, nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	previous := c.lastNetSample
	c.lastNetSample = networkUsageSample{
		measuredAt: now,
		rxBytes:    *rxBytes,
		txBytes:    *txBytes,
	}

	if previous.measuredAt.IsZero() ||
		*rxBytes < previous.rxBytes ||
		*txBytes < previous.txBytes {
		return nil, nil
	}

	elapsedSeconds := now.Sub(previous.measuredAt).Seconds()
	if elapsedSeconds <= 0 {
		return nil, nil
	}

	rxRate := float64(*rxBytes-previous.rxBytes) / elapsedSeconds
	txRate := float64(*txBytes-previous.txBytes) / elapsedSeconds
	if rxRate < 0 || txRate < 0 {
		return nil, nil
	}

	return ptrFloat64(rxRate), ptrFloat64(txRate)
}

func resolveAvailableCores(cpuQuotaCores *float64, goMaxProcs int, cpuLogicalCores int) float64 {
	if cpuQuotaCores != nil && *cpuQuotaCores > 0 {
		return *cpuQuotaCores
	}

	if goMaxProcs > 0 {
		return float64(goMaxProcs)
	}

	if cpuLogicalCores > 0 {
		return float64(cpuLogicalCores)
	}

	return 0
}

type cgroupReader struct {
	procRoot   string
	cgroupRoot string
	version    cgroupVersion
	v2Path     string
	v1Paths    map[string]string
	v1Mounts   map[string]string
}

type cgroupVersion int

const (
	cgroupUnknown cgroupVersion = iota
	cgroupV1
	cgroupV2
)

func newCgroupReader(procRoot string, cgroupRoot string) cgroupReader {
	reader := cgroupReader{
		procRoot:   procRoot,
		cgroupRoot: cgroupRoot,
	}
	reader.detect()
	return reader
}

func (r *cgroupReader) detect() {
	lines, err := readLines(filepath.Join(r.procRoot, "self", "cgroup"))
	if err != nil {
		return
	}

	v1Paths := make(map[string]string)

	for _, line := range lines {
		parts := strings.SplitN(line, ":", 3)
		if len(parts) != 3 {
			continue
		}

		controllers := strings.TrimSpace(parts[1])
		path := normalizeCgroupPath(parts[2])

		if controllers == "" && parts[0] == "0" {
			r.v2Path = path
			continue
		}

		for _, controller := range strings.Split(controllers, ",") {
			controller = strings.TrimSpace(controller)
			if controller == "" {
				continue
			}
			v1Paths[controller] = path
		}
	}

	if r.v2Path == "" && len(v1Paths) == 0 {
		return
	}

	if r.v2Path != "" {
		r.version = cgroupV2
	}

	if len(v1Paths) == 0 {
		return
	}

	r.v1Paths = v1Paths
	r.v1Mounts = parseV1Mounts(filepath.Join(r.procRoot, "self", "mountinfo"))
	r.ensureV1Mount("memory", "memory")
	r.ensureV1Mount("cpu", "cpu,cpuacct", "cpuacct,cpu", "cpu")
	r.ensureV1Mount("cpuacct", "cpu,cpuacct", "cpuacct,cpu", "cpuacct")

	if r.version == cgroupUnknown {
		r.version = cgroupV1
	}
}

func (r *cgroupReader) ensureV1Mount(controller string, candidates ...string) {
	if _, ok := r.v1Mounts[controller]; ok {
		return
	}

	for _, candidate := range candidates {
		fullPath := filepath.Join(r.cgroupRoot, candidate)
		if pathExists(fullPath) {
			r.v1Mounts[controller] = fullPath
			return
		}
	}
}

func (r cgroupReader) readMemoryCurrentBytes() *uint64 {
	switch r.version {
	case cgroupV2:
		if value := r.readUintFromClosestAncestor(r.v2Path, "memory.current"); value != nil {
			return value
		}
		return r.readV1Uint("memory", "memory.usage_in_bytes")
	case cgroupV1:
		return r.readV1Uint("memory", "memory.usage_in_bytes")
	default:
		return nil
	}
}

func (r cgroupReader) readMemoryLimitBytes() (*uint64, bool) {
	switch r.version {
	case cgroupV2:
		value, raw := r.readStringFromClosestAncestor(r.v2Path, "memory.max")
		if raw == "" || value == nil {
			return r.readMemoryLimitBytesV1()
		}

		if strings.EqualFold(*value, "max") {
			return nil, true
		}

		parsed, err := parseUint64(*value)
		if err != nil {
			return nil, false
		}

		return ptrUint64(parsed), false
	case cgroupV1:
		return r.readMemoryLimitBytesV1()
	default:
		return nil, false
	}
}

func (r cgroupReader) readCPUQuotaCores() *float64 {
	switch r.version {
	case cgroupV2:
		value, _ := r.readStringFromClosestAncestor(r.v2Path, "cpu.max")
		if value != nil {
			if parsed := parseV2CPUQuota(*value); parsed != nil {
				return parsed
			}
		}
		return r.readCPUQuotaCoresV1()
	case cgroupV1:
		return r.readCPUQuotaCoresV1()
	default:
		return nil
	}
}

func (r cgroupReader) readCPUUsageNanoseconds() *uint64 {
	switch r.version {
	case cgroupV2:
		content, _ := r.readStringFromClosestAncestor(r.v2Path, "cpu.stat")
		if content != nil {
			if parsed := parseV2CPUUsage(*content); parsed != nil {
				return parsed
			}
		}
		return r.readV1Uint("cpuacct", "cpuacct.usage")
	case cgroupV1:
		return r.readV1Uint("cpuacct", "cpuacct.usage")
	default:
		return nil
	}
}

func (r cgroupReader) readMemoryLimitBytesV1() (*uint64, bool) {
	value := r.readV1Uint("memory", "memory.limit_in_bytes")
	if value == nil {
		return nil, false
	}

	if *value >= unlimitedV1MemoryThreshold {
		return nil, true
	}

	return value, false
}

func (r cgroupReader) readCPUQuotaCoresV1() *float64 {
	quota := r.readV1Int("cpu", "cpu.cfs_quota_us")
	period := r.readV1Uint("cpu", "cpu.cfs_period_us")
	return parseV1CPUQuota(quota, period)
}

func (r cgroupReader) readV1Uint(controller string, fileName string) *uint64 {
	fullPath := r.v1ControllerPath(controller, fileName)
	if fullPath == "" {
		return nil
	}

	return readUintFromPath(fullPath)
}

func (r cgroupReader) readV1Int(controller string, fileName string) *int64 {
	fullPath := r.v1ControllerPath(controller, fileName)
	if fullPath == "" {
		return nil
	}

	return readIntFromPath(fullPath)
}

func (r cgroupReader) v1ControllerPath(controller string, fileName string) string {
	mountPoint := r.v1Mounts[controller]
	relativePath := r.v1Paths[controller]
	if mountPoint == "" || relativePath == "" {
		return ""
	}

	return findClosestExistingFile(mountPoint, relativePath, fileName)
}

func (r cgroupReader) readUintFromClosestAncestor(relativePath string, fileName string) *uint64 {
	fullPath := findClosestExistingFile(r.cgroupRoot, relativePath, fileName)
	if fullPath == "" {
		return nil
	}

	return readUintFromPath(fullPath)
}

func (r cgroupReader) readStringFromClosestAncestor(relativePath string, fileName string) (*string, string) {
	fullPath := findClosestExistingFile(r.cgroupRoot, relativePath, fileName)
	if fullPath == "" {
		return nil, ""
	}

	content, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, fullPath
	}

	value := strings.TrimSpace(string(content))
	return &value, fullPath
}

func parseV2CPUQuota(raw string) *float64 {
	fields := strings.Fields(strings.TrimSpace(raw))
	if len(fields) != 2 {
		return nil
	}

	if fields[0] == "max" {
		return nil
	}

	quotaUS, err := parseUint64(fields[0])
	if err != nil || quotaUS == 0 {
		return nil
	}

	periodUS, err := parseUint64(fields[1])
	if err != nil || periodUS == 0 {
		return nil
	}

	cores := float64(quotaUS) / float64(periodUS)
	return ptrFloat64(cores)
}

func parseV1CPUQuota(quota *int64, period *uint64) *float64 {
	if quota == nil || period == nil {
		return nil
	}

	if *quota <= 0 || *period == 0 {
		return nil
	}

	cores := float64(*quota) / float64(*period)
	return ptrFloat64(cores)
}

func parseV2CPUUsage(raw string) *uint64 {
	scanner := bufio.NewScanner(strings.NewReader(raw))
	for scanner.Scan() {
		fields := strings.Fields(strings.TrimSpace(scanner.Text()))
		if len(fields) != 2 || fields[0] != "usage_usec" {
			continue
		}

		usageUS, err := parseUint64(fields[1])
		if err != nil {
			return nil
		}

		usageNS := usageUS * uint64(time.Microsecond)
		return ptrUint64(usageNS)
	}

	return nil
}

func readNetworkTotalsBytes(procRoot string) (*uint64, *uint64) {
	content, err := os.ReadFile(filepath.Join(procRoot, "net", "dev"))
	if err != nil {
		return nil, nil
	}

	return parseNetworkTotals(content)
}

func parseNetworkTotals(raw []byte) (*uint64, *uint64) {
	scanner := bufio.NewScanner(bytes.NewReader(raw))
	lineNumber := 0
	var rxTotal uint64
	var txTotal uint64
	foundValue := false

	for scanner.Scan() {
		lineNumber += 1
		if lineNumber <= 2 {
			continue
		}

		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}

		fields := strings.Fields(parts[1])
		if len(fields) < 16 {
			continue
		}

		rxBytes, err := parseUint64(fields[0])
		if err != nil {
			continue
		}

		txBytes, err := parseUint64(fields[8])
		if err != nil {
			continue
		}

		rxTotal += rxBytes
		txTotal += txBytes
		foundValue = true
	}

	if err := scanner.Err(); err != nil || !foundValue {
		return nil, nil
	}

	return ptrUint64(rxTotal), ptrUint64(txTotal)
}

func parseV1Mounts(mountInfoPath string) map[string]string {
	content, err := os.ReadFile(mountInfoPath)
	if err != nil {
		return map[string]string{}
	}

	mounts := make(map[string]string)
	scanner := bufio.NewScanner(bytes.NewReader(content))
	skippedOptions := map[string]struct{}{
		"rw":          {},
		"ro":          {},
		"relatime":    {},
		"noatime":     {},
		"nosuid":      {},
		"nodev":       {},
		"noexec":      {},
		"strictatime": {},
	}

	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, " - ", 2)
		if len(parts) != 2 {
			continue
		}

		preFields := strings.Fields(parts[0])
		postFields := strings.Fields(parts[1])
		if len(preFields) < 5 || len(postFields) < 3 || postFields[0] != "cgroup" {
			continue
		}

		mountPoint := preFields[4]
		for _, option := range strings.Split(postFields[2], ",") {
			option = strings.TrimSpace(option)
			if option == "" || strings.Contains(option, "=") {
				continue
			}
			if _, shouldSkip := skippedOptions[option]; shouldSkip {
				continue
			}
			mounts[option] = mountPoint
		}
	}

	return mounts
}

func normalizeCgroupPath(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || trimmed == "." {
		return "/"
	}

	if !strings.HasPrefix(trimmed, "/") {
		return "/" + trimmed
	}

	return filepath.Clean(trimmed)
}

func findClosestExistingFile(baseDir string, relativePath string, fileName string) string {
	currentPath := normalizeCgroupPath(relativePath)

	for {
		candidate := filepath.Join(baseDir, strings.TrimPrefix(currentPath, "/"), fileName)
		if fileExists(candidate) {
			return candidate
		}

		if currentPath == "/" {
			return ""
		}

		parentPath := filepath.Dir(currentPath)
		if parentPath == "." {
			parentPath = "/"
		}
		currentPath = parentPath
	}
}

func readLines(path string) ([]string, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	scanner := bufio.NewScanner(bytes.NewReader(content))
	lines := make([]string, 0, 8)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			lines = append(lines, line)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return lines, nil
}

func readUintFromPath(path string) *uint64 {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	value, err := parseUint64(strings.TrimSpace(string(content)))
	if err != nil {
		return nil
	}

	return ptrUint64(value)
}

func readIntFromPath(path string) *int64 {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	value, err := strconv.ParseInt(strings.TrimSpace(string(content)), 10, 64)
	if err != nil {
		return nil
	}

	return &value
}

func parseUint64(raw string) (uint64, error) {
	return strconv.ParseUint(strings.TrimSpace(raw), 10, 64)
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func pathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func ptrUint64(value uint64) *uint64 {
	return &value
}

func ptrFloat64(value float64) *float64 {
	return &value
}
