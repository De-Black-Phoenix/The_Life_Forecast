## Life Forecast Admin Auth Setup

This guide initializes the new admin authentication flow (email + password + JWT),
while keeping `ADMIN_TOKEN` fallback access.

### 1) Backend environment variables

Set these in `backend/.env` (or your Render env):

```
JWT_SECRET=your-strong-secret
ADMIN_TOKEN=your-admin-token
```

Notes:
- `JWT_SECRET` must be a long random string.
- `ADMIN_TOKEN` is still required for fallback access and password resets.

### 2) Run the admins table migration

Execute the SQL in `backend/ADMIN_AUTH_MIGRATION.sql` inside Supabase SQL editor.

### 3) Create or reset the admin password (developer-only)

Use the reset endpoint to create the admin record or set a temporary password.

```
POST /admin/reset-password
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "email": "admin@example.com",
  "newPassword": "TempPass123!"
}
```

Example cURL:
```
curl -X POST "$API_BASE_URL/admin/reset-password" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","newPassword":"TempPass123!"}'
```

This sets `force_password_change = true` and bumps `token_version`.

### 4) Admin dashboard environment variables

Set these in `admin/.env` (or Vercel env):

```
VITE_API_BASE_URL=https://your-backend.example.com
VITE_ADMIN_TOKEN=your-admin-token
```

Notes:
- `VITE_ADMIN_TOKEN` is used only as a fallback.
- Normal login uses JWT, stored in the browser.

### 5) First login

1) Go to the admin dashboard.
2) Sign in with the email and temporary password.
3) You will be forced to change your password.
4) After password change, the dashboard loads normally.

### 6) Password changes and invalidation

- Any password change or reset increments `token_version`.
- All existing JWTs become invalid.
- Users must log in again after a reset.

### 7) Ongoing admin usage

- Login is required for all admin routes.
- `ADMIN_TOKEN` fallback still works for legacy tooling and resets.
