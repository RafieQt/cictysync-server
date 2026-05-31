 CitySync — Server
 
REST API backend for the CitySync public infrastructure issue reporting platform. Built with Express.js and MongoDB.
 
🌐 **Client Live Site:** [https://citysync-client.web.app/](https://citysync-client.web.app/)  
📦 **Client Repo:** [https://github.com/RafieQt/citySync-client](https://github.com/RafieQt/citySync-client)
 
---
 
## 🛠️ Tech Stack
 
| Technology | Purpose |
|-----------|---------|
| Node.js | Runtime |
| Express.js | Web framework |
| MongoDB | Database |
| JSON Web Token (JWT) | Authentication |
| Stripe | Payment processing |
| dotenv | Environment variables |
| cors | Cross-origin requests |
 
---
 
## 📡 API Endpoints
 
### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/jwt` | Generate JWT token after login |
 
### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users` | 🔒 | Get all users or filter by `?email=` or `?role=` |
| POST | `/users` | — | Create or update user on register |
| PATCH | `/users/:email` | 🔒 | Update user info, role, status, premium |
| DELETE | `/users/:email` | 🔒 Admin | Delete a user |
 
### Issues
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/issues` | — | Get all issues with filter, search, pagination |
| GET | `/issues/resolved` | — | Get latest 6 resolved issues |
| GET | `/issues/user/:email` | 🔒 | Get issues by citizen email |
| GET | `/issues/staff/:email` | 🔒 Staff | Get issues assigned to staff |
| GET | `/issues/:id` | — | Get single issue by ID |
| POST | `/issues` | 🔒 | Create new issue (enforces 3-issue free limit) |
| PATCH | `/issues/:id` | 🔒 | Edit issue / change status / assign staff |
| DELETE | `/issues/:id` | 🔒 | Delete issue |
| PATCH | `/issues/:id/upvote` | 🔒 | Upvote an issue |
 
### Payments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/create-checkout-session` | 🔒 | Create Stripe hosted checkout session |
| POST | `/payments` | 🔒 | Save payment record after Stripe success |
| GET | `/payments` | 🔒 | Get all payments or filter by `?email=` |
 
### Stats
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/stats/admin` | 🔒 Admin | Full system stats |
| GET | `/stats/citizen/:email` | 🔒 | Citizen's own stats |
| GET | `/stats/staff/:email` | 🔒 Staff | Staff's assigned issue stats |
 
---
 
## 🔐 Auth & Roles
 
All protected routes require a JWT token in the Authorization header:
 
```
Authorization: Bearer <token>
```
 
Roles: `citizen`, `staff`, `admin`
 
- Admin-only routes verify the requesting user has `role: "admin"` in DB
- Staff routes verify `role: "staff"` or `role: "admin"`

Vercel live link-
https://citysync-server.vercel.app/