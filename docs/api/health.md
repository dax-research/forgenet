# Health-Check API

The health-check endpoint verifies that the ForgeNet backend is running.

## Request

```http
GET /api/v1/health
```

Authentication is not required, and the request has no body.

## Successful response

Status:

```text
200 OK
```

Example:

```json
{
  "success": true,
  "message": "ForgeNet API is running.",
  "data": {
    "status": "healthy",
    "timestamp": "2026-07-14T12:00:00.000Z",
    "uptimeInSeconds": 10.25
  }
}
```

The timestamp and uptime values change with every request.

## Route not found

Requesting an unavailable route returns:

```text
404 Not Found
```

Example:

```json
{
  "success": false,
  "message": "Route not found: GET /api/v1/unknown"
}
```