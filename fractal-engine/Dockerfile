FROM golang:1.26-alpine AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /out/cloud-scaling-demo-backend \
    ./main.go

FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=builder /out/cloud-scaling-demo-backend /app/server

EXPOSE 6543

ENV PORT=6543

ENTRYPOINT ["/app/server"]
