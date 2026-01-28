# Local Development Environment

Uses **MongoDB** for local development. In production, the app uses Azure Cosmos DB for MongoDB vCore.

## Why MongoDB instead of Cosmos DB Emulator?

The Azure Cosmos DB Emulator (MongoDB API) only supports **x64 architecture**.
For Apple Silicon (M1/M2/M3) and Windows ARM, we use standard MongoDB.

The Mongoose ODM works identically with both:
- **Local**: MongoDB 7.0
- **Production**: Azure Cosmos DB for MongoDB vCore

Reference: https://learn.microsoft.com/en-us/azure/cosmos-db/emulator-linux

## Quick Start

```bash
# Start MongoDB
docker-compose up -d

# Verify it's running
docker-compose ps

# Stop when done
docker-compose down
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| MongoDB | 27017 | Database |
| Mongo Express | 8081 | Web UI |

## Access Mongo Express

Open http://localhost:8081 in your browser.
- Username: `admin`
- Password: `admin`

## Connection String

For backend `.env`:
```env
MONGODB_URI=mongodb://localhost:27017/blogapp
```

## PaaS vs IaaS Difference

| Aspect | IaaS | PaaS |
|--------|------|------|
| Local Database | Docker MongoDB (Replica Set) | Docker MongoDB (Single Node) |
| Production Database | MongoDB on VMs | Cosmos DB for MongoDB vCore |
| Port | 27017 | 27017 |
| Init Script | Required (replica set) | Not needed |
| Data Explorer | Mongo Express | Mongo Express |

## Reset Data

```bash
docker-compose down -v
docker-compose up -d
```

## Troubleshooting

### MongoDB won't start

Check Docker is running:
```bash
docker ps
```

Check logs:
```bash
docker-compose logs -f mongodb
```

### Port already in use

```bash
# Find process using port 27017
lsof -i :27017

# Kill if needed
kill -9 <PID>
```

## Full Setup Guide

See [Local Development Setup](../docs/local-development-setup.md) for complete instructions.
