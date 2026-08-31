# ForgeNet API Guide for Postman

This guide shows the base URLs, token usage, and example request bodies for testing the ForgeNet backend.

## Base URL

```text
http://localhost:5000/api/v1
```

## How to check a token

1. Call login:

```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json
```

Request body:

```json
{
  "email": "ava@example.com",
  "password": "SecurePass123"
}
```

Response example:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "64f9...",
      "name": "Ava Patel",
      "email": "ava@example.com"
    }
  }
}
```

2. Copy the value of `data.token`.
3. In Postman, open the Authorization tab.
4. Set type to `Bearer Token`.
5. Paste the token.
6. Send a protected request such as:

```http
GET http://localhost:5000/api/v1/auth/me
Authorization: Bearer <your-token>
```

If the token is valid, the server will return success. If it is invalid or missing, the API responds with `401`.

You can also quickly inspect the token payload in a browser console or at jwt.io:

```js
const token = "<paste-token-here>";
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);
```

---

## Authentication header format

```http
Authorization: Bearer <token>
```

Protected routes require this header. The backend checks it in the auth middleware and rejects missing or expired tokens with `401`.

---

## User endpoints

### Register user

```http
POST http://localhost:5000/api/v1/users
Content-Type: application/json
```

Example body:

```json
{
  "name": "Ava Patel",
  "email": "ava@example.com",
  "password": "SecurePass123"
}
```

### Login user

```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json
```

Example body:

```json
{
  "email": "ava@example.com",
  "password": "SecurePass123"
}
```

### Get current user

```http
GET http://localhost:5000/api/v1/auth/me
Authorization: Bearer <token>
```

### Update current user

```http
PATCH http://localhost:5000/api/v1/users/me
Authorization: Bearer <token>
Content-Type: application/json
```

Example body:

```json
{
  "bio": "Full-stack developer",
  "skills": ["Node.js", "React", "MongoDB"],
  "githubUrl": "https://github.com/ava"
}
```

### Get all users

```http
GET http://localhost:5000/api/v1/users?limit=10&skip=0
```

### Get one user

```http
GET http://localhost:5000/api/v1/users/<userId>
```

### Follow user

```http
POST http://localhost:5000/api/v1/users/<targetUserId>/follow
Authorization: Bearer <token>
```

### Unfollow user

```http
DELETE http://localhost:5000/api/v1/users/<targetUserId>/follow
Authorization: Bearer <token>
```

### Get followers

```http
GET http://localhost:5000/api/v1/users/<userId>/followers
```

### Get following

```http
GET http://localhost:5000/api/v1/users/<userId>/following
```

### Get saved posts

```http
GET http://localhost:5000/api/v1/users/<userId>/saved-posts
Authorization: Bearer <token>
```

---

## Post endpoints

### Create post

```http
POST http://localhost:5000/api/v1/posts
Authorization: Bearer <token>
Content-Type: application/json
```

Example body:

```json
{
  "content": "Building a developer community platform with Node and React.",
  "tags": ["node", "react", "startup"]
}
```

### Get posts

```http
GET http://localhost:5000/api/v1/posts?limit=10&skip=0
```

### Get one post

```http
GET http://localhost:5000/api/v1/posts/<postId>
```

### Update post

```http
PATCH http://localhost:5000/api/v1/posts/<postId>
Authorization: Bearer <token>
Content-Type: application/json
```

Example body:

```json
{
  "content": "Updated post content"
}
```

### Delete post

```http
DELETE http://localhost:5000/api/v1/posts/<postId>
Authorization: Bearer <token>
```

### Save post

```http
POST http://localhost:5000/api/v1/posts/<postId>/save
Authorization: Bearer <token>
```

### Unsave post

```http
DELETE http://localhost:5000/api/v1/posts/<postId>/save
Authorization: Bearer <token>
```

---

## Project endpoints

### Create project

```http
POST http://localhost:5000/api/v1/projects
Authorization: Bearer <token>
Content-Type: application/json
```

Example body:

```json
{
  "title": "ForgeNet",
  "description": "Developer collaboration platform for projects and communities.",
  "technologies": ["Node.js", "Express", "MongoDB", "React"],
  "githubUrl": "https://github.com/forgenet/app",
  "liveUrl": "https://forgenet.dev"
}
```

### Get projects

```http
GET http://localhost:5000/api/v1/projects?limit=10&skip=0
```

### Search projects

```http
GET http://localhost:5000/api/v1/search/projects?q=forgenet
```

---

## Community endpoints

### Create community

```http
POST http://localhost:5000/api/v1/communities
Authorization: Bearer <token>
Content-Type: application/json
```

Example body:

```json
{
  "name": "AI Builders",
  "description": "A community for developers building AI-powered products.",
  "image": "https://example.com/community.jpg"
}
```

### Get communities

```http
GET http://localhost:5000/api/v1/communities?limit=10&skip=0
```

### Join community

```http
POST http://localhost:5000/api/v1/communities/<communityId>/join
Authorization: Bearer <token>
```

### Leave community

```http
POST http://localhost:5000/api/v1/communities/<communityId>/leave
Authorization: Bearer <token>
```

---

## Comment endpoints

### Create comment

```http
POST http://localhost:5000/api/v1/comments
Authorization: Bearer <token>
Content-Type: application/json
```

Example body:

```json
{
  "post": "<postId>",
  "content": "This is a great project idea!"
}
```

### Get comments for a post

```http
GET http://localhost:5000/api/v1/comments/post/<postId>
```

---

## Search endpoints

### Search users

```http
GET http://localhost:5000/api/v1/search/users?q=ava
```

### Search posts

```http
GET http://localhost:5000/api/v1/search/posts?q=react
```

### Search projects

```http
GET http://localhost:5000/api/v1/search/projects?q=forgenet
```

### Search communities

```http
GET http://localhost:5000/api/v1/search/communities?q=ai
```

---

## Health check

```http
GET http://localhost:5000/api/v1/health
```

---

## Example end-to-end follow flow

### Step 1: create users

```json
{
  "name": "Ava Patel",
  "email": "ava@example.com",
  "password": "SecurePass123"
}
```

```json
{
  "name": "Liam Chen",
  "email": "liam@example.com",
  "password": "SecurePass123"
}
```

```json
{
  "name": "Noah Singh",
  "email": "noah@example.com",
  "password": "SecurePass123"
}
```

### Step 2: login user 1

```http
POST http://localhost:5000/api/v1/auth/login
```

```json
{
  "email": "ava@example.com",
  "password": "SecurePass123"
}
```

### Step 3: follow user 2

```http
POST http://localhost:5000/api/v1/users/<user2Id>/follow
Authorization: Bearer <token1>
```

### Step 4: verify relationship

```http
GET http://localhost:5000/api/v1/users/<user1Id>/following
```

---

## Notes

- All protected endpoints require `Authorization: Bearer <token>`.
- Login returns the token in `data.token`.
- Invalid or expired tokens return `401`.
- Pagination uses query parameters like `limit` and `skip`.
- API reference is also available at:

```http
GET http://localhost:5000/api/docs.json
```
