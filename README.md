# devcraft-orion

## setting up kafka

_NOTE_: you can setup other kafka's like graalVM based etc , follow official instructions in that case

1. pull the official kafka docker image

```
docker pull apache/kafka:4.2.0
```

2. Create topics for bids

```
docker run -it --name kafka -p 9092:9092 apache/kafka:4.2.0
```

3. Create the topic

```
/opt/kafka/bin/kafka-topics.sh \
  --create \
  --topic bids \
  --bootstrap-server localhost:9092 \
  --partitions 3 \
  --replication-factor 1

```

4. check if the topic is created

```
/opt/kafka/bin/kafka-topics.sh \
  --list \
  --bootstrap-server localhost:9092

```
