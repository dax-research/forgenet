# ForgeNet Architecture

ForgeNet is a MERN collaboration and networking platform for programmers.

## Project structure

```text
ForgeNet/
├── client/    React frontend
├── server/    Express backend
└── docs/      Project documentation
```

## Frontend

The frontend uses React with Vite. It is organized by features such as:

- Authentication
- Users
- Posts
- Projects
- Communities
- Chat
- Notifications

## Backend

The backend uses Node.js and Express. Each backend feature can contain:

- Model
- Controller
- Route
- Validation
- Service, when additional business logic is needed

A feature should only contain files that it actually requires.

## Communication

The React frontend communicates with the Express backend through REST APIs.

Socket.IO will later handle:

- Real-time chat
- Typing indicators
- Online status
- Instant notifications

## Database

MongoDB will store application data, and Mongoose will define and validate database models.

## File storage

Multer will process uploaded files. Cloudinary will store uploaded images.

## Initial scope

The initial ForgeNet version will not include:

- AI functionality
- Advertisements
- Subscriptions
- Video calling
- Live streaming
- Pair programming