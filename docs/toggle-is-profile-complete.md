# Toggle `isProfileComplete` — Admin Endpoint

Allows an admin to flip a user's `isProfileComplete` flag without touching any other field.

---

## Endpoint

```http
PATCH /api/v1/users/:id/toggle-is-profile-complete
Authorization: Bearer <admin-token>
```

| Part | Value |
|------|-------|
| Method | `PATCH` |
| Path param | `id` — the user's UUID |
| Auth | Admin JWT (Bearer token) |
| Request body | none |

---

## Success Response — `200 OK`

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "f5d1b2c6-5f3f-403a-a84b-12e42054d8fd",
      "name": "John Doe",
      "provider": "+201234567890",
      "role": "user",
      "isProfileComplete": true,
      "isVerified": true,
      "isBlocked": false,
      "createdAt": "2026-01-10T08:00:00.000Z",
      "updatedAt": "2026-04-25T12:00:00.000Z"
    }
  }
}
```

`isProfileComplete` will be the opposite of whatever it was before the call.

---

## Error Responses

| Status | Reason |
|--------|--------|
| `401` | Missing or invalid token |
| `403` | Authenticated user is not an admin |
| `404` | No user found with the given `id` |

---

## Flutter Integration

### 1. Add the method to your user remote data source

```dart
// lib/data/remote/user_remote_data_source.dart

import 'package:dio/dio.dart';

class UserRemoteDataSource {
  final Dio _dio;

  UserRemoteDataSource(this._dio);

  /// Toggles [isProfileComplete] for [userId].
  /// Returns the updated user map.
  Future<Map<String, dynamic>> toggleIsProfileComplete(String userId) async {
    final response = await _dio.patch(
      '/api/v1/users/$userId/toggle-is-profile-complete',
    );
    return response.data['data']['user'] as Map<String, dynamic>;
  }
}
```

> **Note:** The `Dio` instance must have the `baseUrl` and the admin `Authorization` header set in its `BaseOptions` or via an interceptor.

---

### 2. Dio setup example (if not already done)

```dart
// lib/core/network/dio_client.dart

Dio createDio(String baseUrl, String adminToken) {
  return Dio(
    BaseOptions(
      baseUrl: baseUrl,                       // e.g. https://api.yourapp.com
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {
        'Authorization': 'Bearer $adminToken',
        'Content-Type': 'application/json',
      },
    ),
  );
}
```

---

### 3. Repository layer

```dart
// lib/domain/repositories/user_repository.dart

abstract class UserRepository {
  Future<UserModel> toggleIsProfileComplete(String userId);
}

// lib/data/repositories/user_repository_impl.dart

class UserRepositoryImpl implements UserRepository {
  final UserRemoteDataSource _remote;

  UserRepositoryImpl(this._remote);

  @override
  Future<UserModel> toggleIsProfileComplete(String userId) async {
    final json = await _remote.toggleIsProfileComplete(userId);
    return UserModel.fromJson(json);
  }
}
```

---

### 4. UserModel (relevant fields)

Make sure your `UserModel` includes `isProfileComplete`:

```dart
class UserModel {
  final String id;
  final String name;
  final bool isProfileComplete;
  // ... other fields

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      name: json['name'] as String,
      isProfileComplete: json['isProfileComplete'] as bool? ?? false,
    );
  }
}
```

---

### 5. Calling from the UI (e.g. a toggle switch in the admin panel)

```dart
ElevatedButton(
  onPressed: () async {
    try {
      final updatedUser = await userRepository.toggleIsProfileComplete(userId);
      setState(() {
        isProfileComplete = updatedUser.isProfileComplete;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Profile complete set to ${updatedUser.isProfileComplete}',
          ),
        ),
      );
    } on DioException catch (e) {
      final message = e.response?.data?['message'] ?? 'Something went wrong';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    }
  },
  child: Text(
    isProfileComplete ? 'Mark Incomplete' : 'Mark Complete',
  ),
),
```

---

### 6. Quick test with `curl`

```bash
curl -X PATCH https://your-api.com/api/v1/users/<USER_UUID>/toggle-is-profile-complete \
  -H "Authorization: Bearer <ADMIN_JWT>"
```
