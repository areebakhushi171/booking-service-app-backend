# BookEase Backend Guide

A beginner-friendly guide to the backend's folders, API routes, request flow,
database models, and startup configuration.

## Scope and safety

This guide describes the source files inspected in the backend. The `.env` file
was not inspected, and no secret values are included here. Generated Prisma
clients are present but are not expanded in the folder tree because they are
generated files. Dependencies such as `node_modules` and editor-specific helper
files are omitted.

## 1. Project structure

```text
backend/
├── config/
│   ├── database.js
│   └── socket.js
├── controllers/
│   ├── authController.js
│   ├── bookingController.js
│   ├── favoriteController.js
│   ├── messagingController.js
│   ├── notificationController.js
│   ├── propertyController.js
│   ├── systemController.js
│   └── userController.js
├── middleware/
│   ├── authMiddleware.js
│   ├── imageUploadMiddleware.js
│   └── authorizeRoles.js
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── routes/
│   ├── authRoutes.js
│   ├── bookingRoutes.js
│   ├── favoriteRoutes.js
│   ├── messagingRoutes.js
│   ├── notificationRoutes.js
│   ├── propertyRoutes.js
│   ├── systemRoutes.js
│   └── userRoutes.js
├── services/
│   ├── authService.js
│   ├── bookingService.js
│   ├── favoriteService.js
│   ├── messagingService.js
│   ├── notificationManagementService.js
│   ├── notificationService.js
│   ├── realtimeService.js
│   ├── propertyService.js
│   ├── systemService.js
│   └── userService.js
├── utils/
│   ├── generateToken.js
│   ├── imageStorage.js
│   └── passwordUtils.js
├── validators/
│   ├── authValidators.js
│   ├── bookingValidators.js
│   ├── favoriteValidators.js
│   ├── messagingValidators.js
│   ├── notificationValidators.js
│   └── propertyValidators.js
├── generated/         # Generated Prisma TypeScript client
├── generated-js/      # Compiled JavaScript Prisma client
├── .env               # Environment values; values are not documented here
├── db.js              # Separate PostgreSQL pool
├── package.json
├── package-lock.json
├── prisma.config.ts
├── server.js
└── tsconfig.json
```

### Folder and file responsibilities

- `server.js` creates the Express application, enables JSON request parsing,
  registers the routes, defines the `/` welcome endpoint, and listens on port
  `3000`.
- `routes/` connects URL paths and HTTP methods to middleware, validators, and
  controller functions.
- `controllers/` handles HTTP details: reading request values, selecting
  response status codes, and returning JSON.
- `services/` contains the main business logic and Prisma queries.
- `validators/` contains `express-validator` rules for request bodies, URL
  parameters, and query filters.
- `middleware/` checks JWT authentication and user roles.
- `middleware/imageUploadMiddleware.js` parses multipart image requests into
  memory, limits their size/count, and checks file MIME types and signatures.
- `config/database.js` loads dotenv and exports the reusable Prisma client
  configured with Prisma's PostgreSQL adapter.
- `utils/` contains JWT generation and bcrypt password helpers.
- `prisma/schema.prisma` defines database models, fields, enums, and
  relationships.
- `prisma/migrations/` contains SQL files that describe schema changes.
- `generated/` and `generated-js/` contain generated Prisma client code. These
  are generated from the Prisma schema and are not ordinary application
  modules.
- `prisma.config.ts` tells Prisma CLI where the schema is and gets the datasource
  URL from the environment.
- `tsconfig.json` configures TypeScript compilation of generated Prisma
  TypeScript into `generated-js`. The application itself is written in
  JavaScript.
- `package.json` lists dependencies and scripts. Its `test` script is currently
  a placeholder; there is no `start` script.
- `package-lock.json` records installed npm dependency versions.
- `db.js` creates a separate `pg.Pool` using local connection settings. The
  application services use Prisma; no application imports of this pool were
  found.

## 2. API architecture

The usual request path is:

```text
Flutter / Postman
  → Express route
  → authentication / role middleware, if configured
  → validator middleware, if configured
  → controller
  → service
  → Prisma client
  → PostgreSQL
  → controller sends JSON response
```

`server.js` mounts the route modules. For example, it mounts the booking router
at `/api/bookings`, then the router's `/mine` path forms
`/api/bookings/mine`.

- **Routes:** `routes/*.js`
- **Endpoint registration:** `server.js` mounts routers; each router registers
  its paths with `router.get`, `router.post`, `router.patch`, or
  `router.delete`.
- **Controllers:** `controllers/*.js`
- **Validation:** `validators/*.js`, using `express-validator`
- **Authentication:** `middleware/authMiddleware.js`
- **Role checks:** `middleware/authorizeRoles.js`, plus ownership checks in
  services for resources such as bookings and properties
- **Prisma queries:** feature service files in `services/`
- **Responses and errors:** feature controllers return JSON and status codes.
  Most controllers catch and log errors locally; there is no single
  application-wide error-handling middleware.

The JWT middleware verifies a Bearer token and puts its decoded claims on
`req.user`. Tokens contain `userId` and `role`. The middleware does not fetch the
user from PostgreSQL on every request.

## 3. Complete endpoint list

The role column describes route-level access and, where applicable, the
additional ownership checks in a service. “Public” means the route does not
require this project's JWT middleware.

### Authentication

| Method | Complete URL | Route file | Controller function | Authentication / allowed role | Purpose |
|---|---|---|---|---|---|
| POST | `/api/auth/signup` | `routes/authRoutes.js` | `authController.signup` | Public | Validates registration, creates a user, and returns a JWT. |
| POST | `/api/auth/login` | `routes/authRoutes.js` | `authController.login` | Public | Checks credentials and returns a JWT. |

### Users / Profile

| Method | Complete URL | Route file | Controller function | Authentication / allowed role | Purpose |
|---|---|---|---|---|---|
| GET | `/api/users/me` | `routes/userRoutes.js` | `userController.getProfile` | Authenticated; customer or provider | Gets the authenticated user's profile. |
| PATCH | `/api/users/me` | `routes/userRoutes.js` | `userController.updateProfile` | Authenticated; customer or provider; providers may update business fields | Updates the authenticated user's profile. |
| PATCH | `/api/users/change-password` | `routes/userRoutes.js` | `userController.changePassword` | Authenticated; customer or provider | Verifies the current password and changes it. |
| POST | `/api/users/me/avatar` | `routes/userRoutes.js` | `userController.uploadAvatar` | Authenticated; customer or provider | Uploads or replaces the caller's profile image. |
| DELETE | `/api/users/me/avatar` | `routes/userRoutes.js` | `userController.deleteAvatar` | Authenticated; customer or provider | Deletes the caller's Cloudinary avatar and clears its database reference. |

### Properties / Services

The API uses “property” in its URL and response language, while storing each
listing as a Prisma `Service`.

| Method | Complete URL | Route file | Controller function | Authentication / allowed role | Purpose |
|---|---|---|---|---|---|
| GET | `/api/properties` | `routes/propertyRoutes.js` | `propertyController.listProperties` | Public | Lists active listings and supports search and filters. |
| POST | `/api/properties` | `routes/propertyRoutes.js` | `propertyController.createProperty` | Authenticated provider | Creates a listing owned by the authenticated provider. |
| GET | `/api/properties/owner/me` | `routes/propertyRoutes.js` | `propertyController.listMyProperties` | Authenticated provider | Lists the provider's own listings, including inactive ones. |
| GET | `/api/properties/owner/:ownerId` | `routes/propertyRoutes.js` | `propertyController.listPropertiesByOwner` | Public | Lists active listings for a provider ID. |
| GET | `/api/properties/:id` | `routes/propertyRoutes.js` | `propertyController.getProperty` | Public; an inactive listing is only returned to its owner if authenticated | Retrieves one listing. |
| PATCH | `/api/properties/:id` | `routes/propertyRoutes.js` | `propertyController.updateProperty` | Authenticated provider; must own the listing | Updates editable listing fields. |
| DELETE | `/api/properties/:id/images` | `routes/propertyRoutes.js` | `propertyController.deletePropertyImages` | Authenticated provider; must own the listing | Deletes main and gallery images and clears their references. |
| DELETE | `/api/properties/:id` | `routes/propertyRoutes.js` | `propertyController.deleteProperty` | Authenticated provider; must own the listing | Soft-deletes by setting `isActive` to `false`. |

The listing filters are `q`, `country`, `city`, `category`, `minPrice`,
`maxPrice`, and the paired ISO 8601 date filters `availableFrom` and
`availableTo`. Country and city are strings; the code does not enforce a fixed
list of Dubai or Australia cities.

Provider service creation requires a positive price, and an update rejects any
supplied price that is missing a numeric value, zero, negative, or has more than
two decimal places. Prices must fit the `DECIMAL(10,2)` column. PostgreSQL also
enforces `Service.price > 0`; the existing column is already `NOT NULL`.

The profile upload accepts one multipart field named `avatar`. Property create
and update accept an optional `mainImage` file and up to five repeated
`galleryImages` files. JSON requests without files remain supported. Images
must be JPG/JPEG, PNG, or WEBP, at most 5 MB each. The server verifies both
declared MIME type and file signature before uploading to Cloudinary.
During a property update, `galleryImages` are appended; `mainImage` replaces
the main image. A JSON `gallery` array replaces the gallery, while
`removeGalleryIndexes` (a JSON array such as `[0, 2]`, also accepted as a
multipart JSON string) removes selected gallery entries. Do not send both
`gallery` and `removeGalleryIndexes` in one update.

`imageStorage.js` uses the configured Cloudinary SDK and the
`bookease_images` upload preset. Profile and property images are stored under
`bookease/profiles` and `bookease/services`. The database stores secure URLs and
Cloudinary public IDs, not file bytes. Replacing an image saves the new
reference before attempting to delete the old asset; failed cleanup is surfaced
as a response warning. Existing images without known public IDs are retained
during migration and cannot be deleted from Cloudinary automatically.

### Bookings

| Method | Complete URL | Route file | Controller function | Authentication / allowed role | Purpose |
|---|---|---|---|---|---|
| POST | `/api/bookings` | `routes/bookingRoutes.js` | `bookingController.createBooking` | Authenticated customer | Requests a booking for an active listing. |
| GET | `/api/bookings/mine` | `routes/bookingRoutes.js` | `bookingController.listMyBookings` | Authenticated customer | Lists bookings created by the customer. |
| GET | `/api/bookings/received` | `routes/bookingRoutes.js` | `bookingController.listReceivedBookings` | Authenticated provider | Lists bookings on the provider's listings. |
| GET | `/api/bookings/history` | `routes/bookingRoutes.js` | `bookingController.listBookingHistory` | Authenticated customer or provider | Lists the user's rejected, cancelled, and completed bookings. |
| GET | `/api/bookings/:id` | `routes/bookingRoutes.js` | `bookingController.getBooking` | Authenticated booking customer or listing owner | Returns a booking only to one of its participants. |
| PATCH | `/api/bookings/:id/status` | `routes/bookingRoutes.js` | `bookingController.updateBookingStatus` | Authenticated customer or provider; ownership and transition checks apply | Requests a supported booking status change. |
| PATCH | `/api/bookings/:id/accept` | `routes/bookingRoutes.js` | `bookingController.updateBookingStatus` | Authenticated provider; must own the listing | Requests status `CONFIRMED`. |
| PATCH | `/api/bookings/:id/reject` | `routes/bookingRoutes.js` | `bookingController.updateBookingStatus` | Authenticated provider; must own the listing | Requests status `REJECTED`. |
| PATCH | `/api/bookings/:id/cancel` | `routes/bookingRoutes.js` | `bookingController.updateBookingStatus` | Authenticated booking customer or listing owner | Requests status `CANCELLED`. |

Booking input dates are validated: the start must be in the future and the end
must be later than the start. The service checks overlapping confirmed bookings
when creating or confirming a booking and uses Prisma transactions.

### Favorites

| Method | Complete URL | Route file | Controller function | Authentication / allowed role | Purpose |
|---|---|---|---|---|---|
| GET | `/api/favorites` | `routes/favoriteRoutes.js` | `favoriteController.listFavorites` | Authenticated customer or provider | Lists the authenticated user's favorites. |
| POST | `/api/favorites/:propertyId` | `routes/favoriteRoutes.js` | `favoriteController.addFavorite` | Authenticated customer or provider | Adds an active listing; repeating the request does not create duplicates. |
| GET | `/api/favorites/:propertyId/check` | `routes/favoriteRoutes.js` | `favoriteController.checkFavorite` | Authenticated customer or provider | Checks whether the user favorited a listing. |
| DELETE | `/api/favorites/:propertyId` | `routes/favoriteRoutes.js` | `favoriteController.removeFavorite` | Authenticated customer or provider | Removes that user's favorite record. |

### Conversations / Messages

| Method | Complete URL | Route file | Controller function | Authentication / allowed role | Purpose |
|---|---|---|---|---|---|
| GET | `/api/conversations/unread-count` | `routes/messagingRoutes.js` | `messagingController.getUnreadMessageCount` | Authenticated customer or provider | Counts unread messages in the user's conversations. |
| GET | `/api/conversations` | `routes/messagingRoutes.js` | `messagingController.listConversations` | Authenticated customer or provider | Lists conversations where the user participates. |
| POST | `/api/conversations` | `routes/messagingRoutes.js` | `messagingController.createOrGetConversation` | Authenticated customer or provider; service checks role and ownership | Creates or retrieves the conversation for a customer, owner, and listing. |
| GET | `/api/conversations/:id/messages` | `routes/messagingRoutes.js` | `messagingController.getMessages` | Authenticated conversation participant | Lists messages in the conversation. |
| POST | `/api/conversations/:id/messages` | `routes/messagingRoutes.js` | `messagingController.sendMessage` | Authenticated conversation participant | Sends a message and may notify the other participant. |
| PATCH | `/api/conversations/:id/read` | `routes/messagingRoutes.js` | `messagingController.markMessagesRead` | Authenticated conversation participant | Marks messages from the other participant as read. |

### Notifications

| Method | Complete URL | Route file | Controller function | Authentication / allowed role | Purpose |
|---|---|---|---|---|---|
| GET | `/api/notifications/unread-count` | `routes/notificationRoutes.js` | `notificationController.getUnreadNotificationCount` | Authenticated customer or provider | Returns the unread notification count. |
| GET | `/api/notifications/unread` | `routes/notificationRoutes.js` | `notificationController.listUnreadNotifications` | Authenticated customer or provider | Lists the user's unread notifications. |
| GET | `/api/notifications` | `routes/notificationRoutes.js` | `notificationController.listNotifications` | Authenticated customer or provider | Lists the user's notifications. |
| PATCH | `/api/notifications/read-all` | `routes/notificationRoutes.js` | `notificationController.markAllNotificationsRead` | Authenticated customer or provider | Marks that user's unread notifications as read. |
| PATCH | `/api/notifications/:id/read` | `routes/notificationRoutes.js` | `notificationController.markNotificationRead` | Authenticated customer or provider; only their record is affected | Marks one owned notification as read. |
| DELETE | `/api/notifications/:id` | `routes/notificationRoutes.js` | `notificationController.deleteNotification` | Authenticated customer or provider; only their record is affected | Deletes one owned notification. |

### Other endpoints

| Method | Complete URL | Route file | Controller function | Authentication / allowed role | Purpose |
|---|---|---|---|---|---|
| GET | `/` | `server.js` | Inline handler in `server.js` | Public | Returns the backend-running message. |
| GET | `/api/health` | `routes/systemRoutes.js` | `systemController.health` | Public | Runs a simple Prisma query to check database connectivity. |
| GET | `/api/bookease/users` | `routes/systemRoutes.js` | `systemController.getBookEaseUsers` | Public | Lists selected public profile fields; email and phone are not selected. |

## 4. Request-flow examples

### Signup

```text
POST /api/auth/signup
→ server.js mounts routes/authRoutes.js at /api/auth
→ signupValidators and handleValidationErrors in validators/authValidators.js
→ authController.signup
→ authService.registerUser
→ Prisma checks/creates User; passwordUtils hashes the password
→ generateToken creates a JWT
→ PostgreSQL stores the User
→ controller returns HTTP 201 with token and user fields
```

The response fields are assembled by `authResponseUser` in
`controllers/authController.js`, so a password hash is not part of that response.

### Get profile

```text
GET /api/users/me
→ routes/userRoutes.js
→ authMiddleware verifies Bearer JWT and sets req.user
→ userController.getProfile
→ userService.getProfile(req.user.userId)
→ Prisma User.findUnique with an explicit field selection
→ PostgreSQL returns the profile
→ controller returns HTTP 200 with { message, user }
```

### Search listings

```text
GET /api/properties?city=Dubai&minPrice=100
→ routes/propertyRoutes.js
→ listPropertyValidators in validators/propertyValidators.js
→ propertyController.listProperties
→ propertyService.listProperties builds a Prisma filter
→ Prisma Service.findMany
→ PostgreSQL returns active matching services
→ controller returns HTTP 200 with { message, properties }
```

### Create a booking

```text
POST /api/bookings
→ routes/bookingRoutes.js
→ authMiddleware, then authorizeRoles("customer")
→ createBookingValidators in validators/bookingValidators.js
→ bookingController.createBooking
→ bookingService.createBooking opens a Prisma transaction
→ checks listing status, self-booking, and confirmed-date overlaps
→ creates Booking and conditionally creates an owner notification
→ PostgreSQL commits the transaction
→ controller returns HTTP 201 with the booking
```

### List favorites

```text
GET /api/favorites
→ routes/favoriteRoutes.js applies authMiddleware to the router
→ favoriteController.listFavorites
→ favoriteService.listFavorites(req.user.userId)
→ Prisma Favorite.findMany selects the associated service fields
→ PostgreSQL returns only that user's favorites
→ controller returns HTTP 200 with { message, favorites }
```

### Read messages

```text
GET /api/conversations/:id/messages
→ routes/messagingRoutes.js applies authMiddleware
→ conversationIdValidators
→ messagingController.getMessages
→ messagingService.getMessages checks customerId or ownerId participation
→ Prisma loads messages after the participant check
→ controller returns HTTP 200 with { message, messages }
```

### List unread notifications

```text
GET /api/notifications/unread
→ routes/notificationRoutes.js applies authMiddleware
→ notificationController.listUnreadNotifications
→ notificationManagementService.listNotifications(userId, true)
→ Prisma filters by userId and readAt: null
→ controller returns HTTP 200 with { message, notifications }
```

## 5. Database structure

The database schema is defined in `prisma/schema.prisma`. Fields marked `?`
are nullable. `@id` marks a primary key; `@unique` and `@@unique` mark unique
constraints. Prisma relations are backed by foreign keys.

### Enums

- `UserRole`: `customer`, `provider`.
- `BookingStatus`: `PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`,
  `COMPLETED`.
- `NotificationType`: `BOOKING`, `MESSAGE`.

### Models

#### User

Stores account and profile information.

- `id: String` — primary key, generated with `cuid()`.
- `name`, `email`, `phone`, `passwordHash: String`; `email` is unique.
- `role: UserRole` — defaults to `customer`.
- `avatarUrl`, `businessName`, `businessCategory: String?` — optional.
- `avatarPublicId: String?` — optional Cloudinary asset identifier paired with
  `avatarUrl`.
- `notificationsEnabled`, `darkMode: Boolean` — default to `true` and `false`.
- `createdAt`, `updatedAt: DateTime` — creation/update timestamps.
- Relations: provider-owned services, customer bookings, favorites,
  conversations as customer or owner, sent messages, and notifications.

#### Service

Stores a property/listing (called a “property” by its API).

- `id: String` — primary key, generated with `cuid()`.
- `name`, `description`, `category: String`.
- `price: Decimal @db.Decimal(10, 2)`; `duration: Int`.
- `imageUrl: String?`; `gallery`, `features: String[]`.
- `imagePublicId: String?`; `galleryPublicIds: String[]` — Cloudinary IDs
  aligned with the corresponding image URL fields.
- `isActive: Boolean` — defaults to `true`.
- `providerId: String` — foreign key to `User.id`.
- `country`, `city: String?` — optional location fields.
- `createdAt`, `updatedAt: DateTime`.
- Relations: one required provider; many bookings, favorites, conversations.
- Index on `(country, city)`.

#### Booking

Stores a customer's requested date range for a service.

- `id: String` — primary key, generated with `cuid()`.
- `serviceId`, `customerId: String` — foreign keys to `Service.id` and
  `User.id`.
- `startDate`, `endDate`, `createdAt`, `updatedAt: DateTime`.
- `status: BookingStatus` — defaults to `PENDING`.
- Indexes support customer history and service/date/status queries.

#### Favorite

Stores a user's saved service.

- `id: String` — primary key, generated with `cuid()`.
- `userId`, `serviceId: String` — foreign keys to `User.id` and `Service.id`.
- `createdAt: DateTime`.
- Unique pair `(userId, serviceId)` prevents duplicate favorites.

#### Conversation

Stores a conversation between a customer and owner for a service.

- `id: String` — primary key, generated with `cuid()`.
- `customerId`, `ownerId`, `serviceId: String` — foreign keys to the
  corresponding `User` and `Service` records.
- `createdAt`, `updatedAt: DateTime`.
- Unique triple `(customerId, ownerId, serviceId)` supports create-or-retrieve
  behavior.
- Has many `Message` records.

#### Message

Stores a message and its read state.

- `id: String` — primary key, generated with `cuid()`.
- `conversationId`, `senderId: String` — foreign keys to `Conversation.id`
  and `User.id`.
- `content: String`; `createdAt: DateTime`; `readAt: DateTime?`.
- `readAt` is empty until a participant marks the message read.

#### Notification

Stores a notification belonging to a user.

- `id: String` — primary key, generated with `cuid()`.
- `userId: String` — foreign key to `User.id`.
- `title`, `message: String`; `type: NotificationType`; `data: Json?`.
- `createdAt: DateTime`; `readAt: DateTime?`.
- The notification creation helper checks `notificationsEnabled` first.
- Booking and message events store readable titles and messages alongside
  their event data. Notification list responses include both fields.

## 6. Configuration and startup

- `server.js` creates the Express app, enables `express.json()`, registers
  routes, and listens on port `3000`.
- `config/database.js` loads dotenv and creates a `PrismaClient` using the
  `PrismaPg` adapter.
- `prisma.config.ts` points Prisma CLI commands to the schema and datasource.
- The code expects the environment variable names `DATABASE_URL` and
  `JWT_SECRET`. Cloudinary image storage also expects
  `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
  `CLOUDINARY_API_SECRET`. This guide does not include their values, and `.env`
  was not inspected.
- Start the backend from the backend folder with:

  ```sh
  node server.js
  ```

- `package.json` currently does not define a `start` script.

## 7. Files to study first

For a beginner, this order follows one feature from setup through persistence:

1. `server.js` — how the app starts and mounts routes.
2. `routes/propertyRoutes.js` — how endpoints connect middleware, validation,
   and controllers.
3. `controllers/propertyController.js` — how HTTP responses are created.
4. `services/propertyService.js` — how business logic and Prisma queries work.
5. `prisma/schema.prisma` — what data those queries store and retrieve.
6. `middleware/authMiddleware.js` and `middleware/authorizeRoles.js` — how
   authentication and role checks work.

## 8. Architecture notes

- Property endpoints operate on the existing `Service` model; there is no
  separate `Property` table.
- Availability is based on date ranges and confirmed bookings. There is no
  weekly schedule or owner-managed time-slot model.
- Country and city are free-form strings in the schema rather than a fixed
  Dubai/Australia location enum.
- Validation and error handling are implemented per feature; some patterns are
  repeated rather than shared through a single global handler.
- The `test` script in `package.json` is a placeholder, and the project has no
  application-wide Express error handler.
- `db.js` is separate from the Prisma database client used by the API services.
- `GET /api/bookease/users` is public and selects a limited set of profile and
  business fields; it does not select email or phone.

## 9. Real-time events with Socket.IO

The backend attaches Socket.IO to the same HTTP server as Express. REST routes
remain available and are still the source of truth for message history,
bookings, notifications, and service data. A real-time event is emitted only
after its corresponding database transaction has completed.

### Setup and startup

`socket.io` is a backend dependency. Install dependencies with:

```sh
npm install
```

The backend continues to use `DATABASE_URL` and `JWT_SECRET`. Set
`CLIENT_ORIGIN` to the allowed web client origin when using a browser; if it is
unset, the Socket.IO server allows cross-origin handshakes, while JWT
authentication and private-room authorization still apply. Flutter clients
using native transports do not use browser CORS enforcement.
The HTTP server listens on port `3000` by default; `PORT` can override it.
For temporary connection, room, and event-emission diagnostics, set
`SOCKET_DEBUG=true` before starting the backend. Logs include authenticated user
IDs and event names only; they never include JWTs or message contents. Disable
the option after troubleshooting.

Start the backend from this directory:

```sh
node server.js
```

There are no Socket.IO schema changes or Prisma migrations.

### Authentication and rooms

Connect using the same JWT returned by the existing login/signup endpoints:

```js
const socket = io(API_URL, {
  auth: { token: jwt }
});
```

The server verifies the token with the existing `JWT_SECRET` and uses only the
verified `userId` and `role` claims. It automatically joins the connection to
`user:{userId}`. Clients cannot request arbitrary user rooms.

Join a conversation only after its REST conversation is available:

```js
socket.emit("conversation:join", { conversationId }, (result) => {
  if (result.error) console.error(result.error);
});
```

The server checks `Conversation.customerId` and `Conversation.ownerId` before
joining `conversation:{conversationId}`. The matching
`conversation:leave` event performs the same authorization check. Typing
events are accepted only from a socket that successfully joined that
conversation room. Never send a user ID as proof of identity.

### Event contracts

Client-to-server events:

| Event | Payload | Result |
|---|---|---|
| `conversation:join` | `{ conversationId }` | Acknowledges authorized room join or returns an error. |
| `conversation:leave` | `{ conversationId }` | Acknowledges authorized room leave or returns an error. |
| `message:typing` | `{ conversationId }` | Relays a typing indicator to the other authorized room members. |
| `message:stop_typing` | `{ conversationId }` | Relays that typing stopped to the other authorized room members. |

Server-to-client events:

| Event | Recipient | Payload |
|---|---|---|
| `message:new` | Message recipient's private user room | `{ conversationId, message, unreadCount, globalUnreadCount }` |
| `message:read` | Original sender's private user room | `{ conversationId, readerId, messageIds, readAt }` |
| `message:typing` / `message:stop_typing` | Other participants in the authorized conversation room | `{ conversationId, userId }`; `userId` comes from the verified token. |
| `conversation:updated` | Conversation participants' private user rooms | `{ conversationId, latestMessage }` for a new message, or `{ conversation }` when newly created. |
| `chat:unread_count_updated` | Affected user's private user room | `{ unreadCount }`, calculated from PostgreSQL. |
| `booking:created` | Provider's private user room | `{ booking }` |
| `booking:accepted`, `booking:rejected`, `booking:cancelled`, `booking:completed` | Booking participants' private user rooms | `{ booking }` with the persisted status. |
| `booking:updated` | Booking participants' private user rooms | `{ booking }` with the persisted booking. |
| `notification:new` | Notification owner's private user room | Persisted notification fields: `id`, `type`, `title`, `message`, `data`, `createdAt`, and `readAt`. |
| `notification:read` | Notification owner's private user room | `{ notificationId, readAt, unreadCount }`, or `{ all: true, readAt, unreadCount }`. |
| `notification:deleted` | Notification owner's private user room | `{ notificationId, unreadCount }` |
| `notification:unread_count_updated` | Notification owner's private user room | `{ unreadCount }`, calculated from PostgreSQL. |
| `user:online`, `user:offline` | Other users with a shared conversation | `{ userId }`; presence is based on active socket connections. |
| `service:created`, `service:updated`, `service:deleted` | Provider and known users who favorited or have a conversation for the service | `{ service }` with public service fields; Cloudinary public IDs are omitted. |
| `favorite:added` | Favoriting user's private user room | `{ userId, favorite }` |
| `favorite:removed` | Favoriting user's private user room | `{ userId, serviceId }` |

Booking-specific events are emitted alongside `booking:updated` so clients can
either handle the explicit state transition or refresh their dashboard data.
Unread message counts exclude the authenticated user's outgoing messages.
Notification and message updates continue to use their existing REST endpoints;
Socket.IO does not create an alternate write path.

Example server-to-client payloads:

```json
{
  "event": "message:new",
  "payload": {
    "conversationId": "conversation-id",
    "message": {
      "id": "message-id",
      "senderId": "customer-id",
      "content": "Hello",
      "readAt": null
    },
    "unreadCount": 1,
    "globalUnreadCount": 1
  }
}
```

```json
{
  "event": "booking:accepted",
  "payload": {
    "booking": {
      "id": "booking-id",
      "status": "CONFIRMED"
    }
  }
}
```

```json
{
  "event": "notification:new",
  "payload": {
    "id": "notification-id",
    "type": "MESSAGE",
    "title": "New Message",
    "message": "You have a new message.",
    "data": {
      "conversationId": "conversation-id",
      "messageId": "message-id"
    },
    "createdAt": "2026-11-25T10:00:00.000Z",
    "readAt": null
  }
}
```

### Persistence, retries, and recovery

Messages, bookings, and notifications are saved with the existing Prisma
services before the server emits their real-time events. Reconnects do not
replay events; use `GET /api/conversations`, `GET
/api/conversations/:id/messages`, the existing booking endpoints, and the
notification endpoints to recover current database state.

Socket delivery is not an exactly-once transport. Clients should upsert
messages by message `id`, notifications by notification `id`, and bookings by
booking `id` so reconnects or client-side retries do not duplicate displayed
items. Mutations continue through REST; no new Socket.IO message/booking write
command or idempotency key is introduced.

### Testing

Validate the schema and JavaScript syntax with:

```sh
npx prisma validate
node --check server.js
node --check config/socket.js
node --check services/realtimeService.js
```

Connect a customer and provider using valid login tokens, join their shared
conversation from both sockets, and verify message, read, and typing events.
Try joining the room with a third user's token and verify the acknowledgement
returns an error. Exercise booking transitions and notification read operations
through their existing REST endpoints while listening for their corresponding
events. Also test a missing/expired token, disconnect/reconnect, and REST
recovery after reconnect. The package's existing `npm test` command is a
placeholder and does not run an application test suite.

### Background push notifications

FCM is not configured in this backend. Socket.IO delivers events only while a
client has an active connection; background/closed-app push requires a
separately configured FCM project, server credentials, device-token storage,
and Flutter registration. No FCM delivery is claimed or implemented here.

## Booking price snapshots and provider dashboard

Creating a booking reads the service price from PostgreSQL and stores it in
`Booking.servicePrice`. Client-supplied prices are ignored. Booking responses
and booking Socket.IO events include that saved amount; subsequent service
price changes do not alter existing booking amounts.

Existing rows have no reliable historical price source because the earlier
schema did not store booking prices. The migration leaves those amounts `NULL`
instead of substituting the current service price. Clients display
`Amount unavailable` when no saved amount or explicit amount field is present.

Providers can fetch `GET /api/bookings/dashboard` with their existing JWT. The
response includes `totalEarnings`, `completedBookingsCount`,
`pendingBookingsCount`, `acceptedBookingsCount`, and `totalBookingsCount`.
Earnings are recalculated from that provider's `COMPLETED` bookings using the
saved `Booking.servicePrice`; status updates do not increment a cached total.
Providers are also notified through the existing `booking:updated` and
`booking:completed` events, and the Flutter dashboard refetches this summary.
