services/api/
├── src/
│   ├── routes/                 # thin — just Express.Router() + auth middleware
│   │   ├── index.ts            # mounts all routers
│   │   ├── coin.routes.ts
│   │   ├── alert.routes.ts
│   │   ├── news.routes.ts
│   │   └── portfolio.routes.ts
│   │
│   ├── controllers/            # request/response handling only
│   │   ├── coin.controller.ts
│   │   ├── alert.controller.ts
│   │   ├── news.controller.ts
│   │   └── portfolio.controller.ts
│   │
│   ├── services/               # business logic, no req/res objects
│   │   ├── coin.service.ts
│   │   ├── alert.service.ts
│   │   ├── news.service.ts
│   │   └── portfolio.service.ts
│   │
│   ├── models/                 # DB query functions (Prisma or pg)
│   │   ├── coin.model.ts
│   │   ├── alert.model.ts
│   │   └── news.model.ts
│   │
│   ├── websocket/
│   │   ├── wsServer.ts         # ws.Server setup, room management
│   │   └── redisSubscriber.ts  # subscribes to Redis, forwards to WS clients
│   │
│   ├── middleware/
│   │   ├── auth.ts             # JWT verify
│   │   ├── errorHandler.ts
│   │   └── rateLimit.ts
│   │
│   ├── config/
│   │   ├── db.ts               # Postgres pool
│   │   └── redis.ts            # Redis client
│   │
│   └── app.ts                  # Express app + server bootstrap
├── prisma/
│   └── schema.prisma
└── package.json