FROM golang:1.25-alpine AS builder

# Install build tools and librdkafka
RUN apk add --no-cache \
    build-base \
    librdkafka-dev \
    git 

WORKDIR /build

COPY go.mod go.sum ./

RUN go mod download

COPY . .

RUN go build -tags musl -o app .

FROM alpine:3.21 AS final

RUN apk add --no-cache tzdata

COPY --from=builder /build/app / 

EXPOSE 3000

CMD ["./app"]
