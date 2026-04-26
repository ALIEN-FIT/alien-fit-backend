# Flutter Admin Workout Plan Management Guide

This guide explains how to implement admin workout plan editing functionality in your Flutter app.

## Overview

Admin users can:
- ✏️ Update workout days (name and items)
- 🗑️ Clear entire workout days
- 🏋️ Update individual workout items (exercise type, sets, reps, etc.)
- ❌ Delete workout items
- 🔄 Change exercise types (REGULAR, SUPERSET, DROPSET, CIRCUIT)

---

## 1. API Service Layer

Create a service to handle API calls to the backend:

### File: `lib/services/admin_workout_service.dart`

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:your_app/models/training_plan.dart';

class AdminWorkoutService {
  final String baseUrl;
  final String token;

  AdminWorkoutService({
    required this.baseUrl,
    required this.token,
  });

  final Map<String, String> _headers = {
    'Content-Type': 'application/json',
  };

  Map<String, String> _getAuthHeaders() {
    return {
      ..._headers,
      'Authorization': 'Bearer $token',
    };
  }

  /// Update a training plan day
  /// 
  /// [planId] - Training plan ID
  /// [dayIndex] - Day index (1-28)
  /// [name] - Day name (optional)
  /// [items] - List of training items (optional)
  Future<TrainingPlan> updateTrainingDay({
    required String planId,
    required int dayIndex,
    String? name,
    List<Map<String, dynamic>>? items,
  }) async {
    final body = <String, dynamic>{};
    
    if (name != null) body['name'] = name;
    if (items != null) body['items'] = items;

    final response = await http.patch(
      Uri.parse('$baseUrl/training-plan/admin/$planId/day/$dayIndex'),
      headers: _getAuthHeaders(),
      body: jsonEncode(body),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return TrainingPlan.fromJson(data['data']['trainingPlan']);
    } else {
      throw Exception('Failed to update training day: ${response.body}');
    }
  }

  /// Clear a training day (remove all items)
  Future<TrainingPlan> clearTrainingDay({
    required String planId,
    required int dayIndex,
  }) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/training-plan/admin/$planId/day/$dayIndex'),
      headers: _getAuthHeaders(),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return TrainingPlan.fromJson(data['data']['trainingPlan']);
    } else {
      throw Exception('Failed to clear training day: ${response.body}');
    }
  }

  /// Update a training plan item
  /// 
  /// [itemId] - Training item ID
  /// [updates] - Map of fields to update:
  ///   - trainingVideoId: String
  ///   - sets: int
  ///   - repeats: int
  ///   - itemType: 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT'
  ///   - supersetItems: List<Map>
  ///   - dropsetConfig: Map
  ///   - circuitItems: List<Map>
  ///   - note: String
  Future<TrainingPlan> updateTrainingItem({
    required String itemId,
    required Map<String, dynamic> updates,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/training-plan/admin/item/$itemId'),
      headers: _getAuthHeaders(),
      body: jsonEncode(updates),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return TrainingPlan.fromJson(data['data']['trainingPlan']);
    } else {
      throw Exception('Failed to update training item: ${response.body}');
    }
  }

  /// Delete a training plan item
  Future<TrainingPlan> deleteTrainingItem({
    required String itemId,
  }) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/training-plan/admin/item/$itemId'),
      headers: _getAuthHeaders(),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return TrainingPlan.fromJson(data['data']['trainingPlan']);
    } else {
      throw Exception('Failed to delete training item: ${response.body}');
    }
  }
}
```

---

## 2. Models

### File: `lib/models/training_item.dart`

```dart
class TrainingItem {
  final String id;
  final int order;
  final int? sets;
  final int? repeats;
  final bool isSuperset;
  final String itemType; // 'REGULAR', 'SUPERSET', 'DROPSET', 'CIRCUIT'
  final bool isDone;
  final TrainingVideo? trainingVideo;
  final List<SupersetItem> supersetItems;
  final List<CircuitItem> circuitItems;
  final DropsetConfig? dropsetConfig;
  final String? circuitGroup;
  final String? note;

  TrainingItem({
    required this.id,
    required this.order,
    this.sets,
    this.repeats,
    required this.isSuperset,
    required this.itemType,
    required this.isDone,
    this.trainingVideo,
    required this.supersetItems,
    required this.circuitItems,
    this.dropsetConfig,
    this.circuitGroup,
    this.note,
  });

  factory TrainingItem.fromJson(Map<String, dynamic> json) {
    return TrainingItem(
      id: json['id'],
      order: json['order'],
      sets: json['sets'],
      repeats: json['repeats'],
      isSuperset: json['isSuperset'] ?? false,
      itemType: json['itemType'] ?? 'REGULAR',
      isDone: json['isDone'] ?? false,
      trainingVideo: json['trainingVideo'] != null
          ? TrainingVideo.fromJson(json['trainingVideo'])
          : null,
      supersetItems: List<SupersetItem>.from(
        (json['supersetItems'] ?? []).map(
          (item) => SupersetItem.fromJson(item),
        ),
      ),
      circuitItems: List<CircuitItem>.from(
        (json['circuitItems'] ?? []).map(
          (item) => CircuitItem.fromJson(item),
        ),
      ),
      dropsetConfig: json['dropsetConfig'] != null
          ? DropsetConfig.fromJson(json['dropsetConfig'])
          : null,
      circuitGroup: json['circuitGroup'],
      note: json['note'],
    );
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = {
      'id': id,
      'order': order,
      'isSuperset': isSuperset,
      'itemType': itemType,
    };

    if (sets != null) data['sets'] = sets;
    if (repeats != null) data['repeats'] = repeats;
    if (trainingVideo != null) data['trainingVideoId'] = trainingVideo!.id;
    if (supersetItems.isNotEmpty) {
      data['supersetItems'] = supersetItems.map((e) => e.toJson()).toList();
    }
    if (circuitItems.isNotEmpty) {
      data['circuitItems'] = circuitItems.map((e) => e.toJson()).toList();
    }
    if (dropsetConfig != null) data['dropsetConfig'] = dropsetConfig!.toJson();
    if (circuitGroup != null) data['circuitGroup'] = circuitGroup;
    if (note != null) data['note'] = note;

    return data;
  }
}

class SupersetItem {
  final String trainingVideoId;
  final int sets;
  final int repeats;
  final TrainingVideo? trainingVideo;

  SupersetItem({
    required this.trainingVideoId,
    required this.sets,
    required this.repeats,
    this.trainingVideo,
  });

  factory SupersetItem.fromJson(Map<String, dynamic> json) {
    return SupersetItem(
      trainingVideoId: json['trainingVideoId'],
      sets: json['sets'],
      repeats: json['repeats'],
      trainingVideo: json['trainingVideo'] != null
          ? TrainingVideo.fromJson(json['trainingVideo'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'trainingVideoId': trainingVideoId,
      'sets': sets,
      'repeats': repeats,
    };
  }
}

class CircuitItem {
  final String trainingVideoId;
  final int sets;
  final int repeats;
  final TrainingVideo? trainingVideo;

  CircuitItem({
    required this.trainingVideoId,
    required this.sets,
    required this.repeats,
    this.trainingVideo,
  });

  factory CircuitItem.fromJson(Map<String, dynamic> json) {
    return CircuitItem(
      trainingVideoId: json['trainingVideoId'],
      sets: json['sets'],
      repeats: json['repeats'],
      trainingVideo: json['trainingVideo'] != null
          ? TrainingVideo.fromJson(json['trainingVideo'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'trainingVideoId': trainingVideoId,
      'sets': sets,
      'repeats': repeats,
    };
  }
}

class DropsetConfig {
  final List<double> dropPercents;
  final int? restSeconds;

  DropsetConfig({
    required this.dropPercents,
    this.restSeconds,
  });

  factory DropsetConfig.fromJson(Map<String, dynamic> json) {
    return DropsetConfig(
      dropPercents: List<double>.from(json['dropPercents'] ?? []),
      restSeconds: json['restSeconds'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'dropPercents': dropPercents,
      if (restSeconds != null) 'restSeconds': restSeconds,
    };
  }
}

class TrainingVideo {
  final String id;
  final String title;
  final String? description;
  final String videoUrl;

  TrainingVideo({
    required this.id,
    required this.title,
    this.description,
    required this.videoUrl,
  });

  factory TrainingVideo.fromJson(Map<String, dynamic> json) {
    return TrainingVideo(
      id: json['id'],
      title: json['title'],
      description: json['description'],
      videoUrl: json['videoUrl'],
    );
  }
}
```

---

## 3. State Management (Provider Pattern)

### File: `lib/providers/admin_workout_provider.dart`

```dart
import 'package:flutter/foundation.dart';
import 'package:your_app/models/training_plan.dart';
import 'package:your_app/services/admin_workout_service.dart';

class AdminWorkoutProvider with ChangeNotifier {
  final AdminWorkoutService _service;
  
  TrainingPlan? _currentPlan;
  bool _isLoading = false;
  String? _error;

  AdminWorkoutProvider(this._service);

  // Getters
  TrainingPlan? get currentPlan => _currentPlan;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Update training day
  Future<void> updateDay({
    required String planId,
    required int dayIndex,
    String? name,
    List<Map<String, dynamic>>? items,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      _currentPlan = await _service.updateTrainingDay(
        planId: planId,
        dayIndex: dayIndex,
        name: name,
        items: items,
      );
      notifyListeners();
    } catch (e) {
      _setError(e.toString());
    } finally {
      _setLoading(false);
    }
  }

  // Clear training day
  Future<void> clearDay({
    required String planId,
    required int dayIndex,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      _currentPlan = await _service.clearTrainingDay(
        planId: planId,
        dayIndex: dayIndex,
      );
      notifyListeners();
    } catch (e) {
      _setError(e.toString());
    } finally {
      _setLoading(false);
    }
  }

  // Update training item
  Future<void> updateItem({
    required String itemId,
    required Map<String, dynamic> updates,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      _currentPlan = await _service.updateTrainingItem(
        itemId: itemId,
        updates: updates,
      );
      notifyListeners();
    } catch (e) {
      _setError(e.toString());
    } finally {
      _setLoading(false);
    }
  }

  // Delete training item
  Future<void> deleteItem({required String itemId}) async {
    _setLoading(true);
    _clearError();

    try {
      _currentPlan = await _service.deleteTrainingItem(itemId: itemId);
      notifyListeners();
    } catch (e) {
      _setError(e.toString());
    } finally {
      _setLoading(false);
    }
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  void _setError(String error) {
    _error = error;
    notifyListeners();
  }

  void _clearError() {
    _error = null;
  }
}
```

---

## 4. UI Components

### File: `lib/screens/admin/edit_workout_day_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:your_app/providers/admin_workout_provider.dart';

class EditWorkoutDayScreen extends StatefulWidget {
  final String planId;
  final int dayIndex;
  final String dayName;
  final List<TrainingItem> items;

  const EditWorkoutDayScreen({
    Key? key,
    required this.planId,
    required this.dayIndex,
    required this.dayName,
    required this.items,
  }) : super(key: key);

  @override
  State<EditWorkoutDayScreen> createState() => _EditWorkoutDayScreenState();
}

class _EditWorkoutDayScreenState extends State<EditWorkoutDayScreen> {
  late TextEditingController _dayNameController;
  late List<TrainingItem> _items;

  @override
  void initState() {
    super.initState();
    _dayNameController = TextEditingController(text: widget.dayName);
    _items = List.from(widget.items);
  }

  @override
  void dispose() {
    _dayNameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Edit Day ${widget.dayIndex}'),
        actions: [
          TextButton(
            onPressed: _saveChanges,
            child: const Text('Save'),
          ),
        ],
      ),
      body: Consumer<AdminWorkoutProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Day name field
                TextField(
                  controller: _dayNameController,
                  decoration: const InputDecoration(
                    labelText: 'Day Name',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 24),
                
                // Items section
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Workout Items',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    ElevatedButton.icon(
                      onPressed: _addItem,
                      icon: const Icon(Icons.add),
                      label: const Text('Add Item'),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Items list
                ..._items.asMap().entries.map((entry) {
                  int index = entry.key;
                  TrainingItem item = entry.value;
                  return _buildItemCard(context, index, item, provider);
                }).toList(),

                const SizedBox(height: 24),
                
                // Clear day button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _clearDay,
                    icon: const Icon(Icons.delete_sweep),
                    label: const Text('Clear Entire Day'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildItemCard(
    BuildContext context,
    int index,
    TrainingItem item,
    AdminWorkoutProvider provider,
  ) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Item ${index + 1}: ${item.itemType}',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                IconButton(
                  icon: const Icon(Icons.delete, color: Colors.red),
                  onPressed: () => _deleteItem(context, provider, item.id),
                  tooltip: 'Delete item',
                ),
              ],
            ),
            const SizedBox(height: 12),
            
            // Item type dropdown
            DropdownButtonFormField<String>(
              value: item.itemType,
              onChanged: (value) {
                if (value != null) {
                  _editItem(context, index, {'itemType': value});
                }
              },
              items: ['REGULAR', 'SUPERSET', 'DROPSET', 'CIRCUIT']
                  .map((type) => DropdownMenuItem(
                    value: type,
                    child: Text(type),
                  ))
                  .toList(),
              decoration: const InputDecoration(
                labelText: 'Exercise Type',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),

            // Exercise name
            if (item.trainingVideo != null)
              Text('Exercise: ${item.trainingVideo!.title}'),
            const SizedBox(height: 12),

            // Sets and repeats
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    initialValue: item.sets?.toString() ?? '',
                    decoration: const InputDecoration(
                      labelText: 'Sets',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (value) {
                      if (value.isNotEmpty) {
                        _editItem(context, index, {'sets': int.parse(value)});
                      }
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    initialValue: item.repeats?.toString() ?? '',
                    decoration: const InputDecoration(
                      labelText: 'Repeats',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (value) {
                      if (value.isNotEmpty) {
                        _editItem(context, index, {'repeats': int.parse(value)});
                      }
                    },
                  ),
                ),
              ],
            ),
            
            // Edit button
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => _showEditDialog(context, index, item),
              child: const Text('Edit Details'),
            ),
          ],
        ),
      ),
    );
  }

  void _addItem() {
    // Show dialog to add new item
    showDialog(
      context: context,
      builder: (context) => const AddItemDialog(),
    );
  }

  void _editItem(BuildContext context, int index, Map<String, dynamic> updates) {
    setState(() {
      // Update the item locally
      // Then save to backend
    });
  }

  void _deleteItem(
    BuildContext context,
    AdminWorkoutProvider provider,
    String itemId,
  ) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Item'),
        content: const Text('Are you sure you want to delete this item?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              provider.deleteItem(itemId: itemId);
              Navigator.pop(context);
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showEditDialog(BuildContext context, int index, TrainingItem item) {
    showDialog(
      context: context,
      builder: (context) => EditItemDialog(
        item: item,
        onSave: (updates) {
          Provider.of<AdminWorkoutProvider>(context, listen: false)
              .updateItem(itemId: item.id, updates: updates);
          Navigator.pop(context);
        },
      ),
    );
  }

  void _saveChanges() {
    final provider = Provider.of<AdminWorkoutProvider>(context, listen: false);
    
    provider.updateDay(
      planId: widget.planId,
      dayIndex: widget.dayIndex,
      name: _dayNameController.text,
    );
    
    Navigator.pop(context);
  }

  void _clearDay() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear Day'),
        content: const Text('This will remove all items from this day. Are you sure?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              final provider = Provider.of<AdminWorkoutProvider>(
                context,
                listen: false,
              );
              provider.clearDay(
                planId: widget.planId,
                dayIndex: widget.dayIndex,
              );
              Navigator.pop(context);
              Navigator.pop(context); // Close edit screen
            },
            child: const Text('Clear'),
          ),
        ],
      ),
    );
  }
}
```

---

## 5. Setup Instructions

### Step 1: Add Dependencies to `pubspec.yaml`

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.1.0
  provider: ^6.0.0
  # Your other dependencies
```

### Step 2: Create Provider in `main.dart`

```dart
void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => AdminWorkoutProvider(
            AdminWorkoutService(
              baseUrl: 'YOUR_API_BASE_URL',
              token: 'USER_TOKEN_HERE',
            ),
          ),
        ),
      ],
      child: const MyApp(),
    ),
  );
}
```

### Step 3: Add Authentication

Ensure the user token is properly managed:

```dart
// Example with secure storage
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AdminWorkoutService {
  final _storage = const FlutterSecureStorage();

  Future<String> _getToken() async {
    return await _storage.read(key: 'auth_token') ?? '';
  }

  Map<String, String> _getAuthHeaders() async {
    final token = await _getToken();
    return {
      ..._headers,
      'Authorization': 'Bearer $token',
    };
  }
}
```

---

## 6. Example Usage

```dart
// Update a specific item (change type from REGULAR to SUPERSET)
await provider.updateItem(
  itemId: 'item-id-123',
  updates: {
    'itemType': 'SUPERSET',
    'supersetItems': [
      {
        'trainingVideoId': 'video-1',
        'sets': 3,
        'repeats': 10,
      },
      {
        'trainingVideoId': 'video-2',
        'sets': 3,
        'repeats': 12,
      },
    ],
  },
);

// Update sets and repeats
await provider.updateItem(
  itemId: 'item-id-123',
  updates: {
    'sets': 4,
    'repeats': 8,
  },
);

// Change to dropset
await provider.updateItem(
  itemId: 'item-id-123',
  updates: {
    'itemType': 'DROPSET',
    'dropsetConfig': {
      'dropPercents': [100, 80, 60],
      'restSeconds': 30,
    },
  },
);
```

---

## 7. Security Considerations

✅ **Always validate and authorize:**
- Verify user is admin before showing admin features
- Validate all inputs before sending to backend
- Use HTTPS for API calls
- Secure token storage (use flutter_secure_storage)
- Implement proper error handling and logging

---

## 8. Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Unauthorized error (401) | Check if token is valid and not expired |
| Invalid item type error | Ensure itemType matches allowed values |
| Superset validation fails | Provide at least 2 exercises in supersetItems |
| CORS errors | Check backend CORS configuration |

---

## 9. Testing

```dart
// Example unit test
void main() {
  group('AdminWorkoutProvider', () {
    test('update item should call service and notify listeners', () async {
      final mockService = MockAdminWorkoutService();
      final provider = AdminWorkoutProvider(mockService);

      await provider.updateItem(
        itemId: 'test-id',
        updates: {'sets': 4},
      );

      expect(provider.isLoading, false);
      expect(provider.error, null);
      verify(mockService.updateTrainingItem(
        itemId: 'test-id',
        updates: {'sets': 4},
      )).called(1);
    });
  });
}
```

---

## Summary

This guide provides everything needed to implement admin workout plan editing in Flutter:
- ✅ API service with all admin endpoints
- ✅ Data models for training items
- ✅ State management with Provider
- ✅ UI components for editing
- ✅ Security best practices
- ✅ Example usage and testing

Start with the API service, then build the UI components incrementally!
