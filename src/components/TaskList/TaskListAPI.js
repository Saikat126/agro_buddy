import client from '../../api/client';


// Title is the only field that's truly required — everything else is optional.

export function validateTaskData(data) {
  const errors = {};

  if (!data.title || !data.title.trim()) {
    errors.title = 'Task title is required.';
  }

  if (data.dueDate || data.due_date) {
    const raw = data.dueDate || data.due_date;
    if (isNaN(Date.parse(raw))) {
      errors.dueDate = 'Due date must be a valid date (YYYY-MM-DD).';
    }
  }

  const allowed = ['low', 'medium', 'high'];
  if (data.priority && !allowed.includes(data.priority.toLowerCase())) {
    errors.priority = `Priority must be 'low', 'medium', or 'high'.`;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}


// Fetches all tasks for the current user sorted by due date, earliest first.
// The backend already returns camelCase fields (dueDate, isRepeating, animalId, …).

export async function fetchTasks() {
  const { data } = await client.get('/tasks');
  return data;
}


// Convenience fetch for when you only want pending or completed tasks.
export async function fetchTasksByCompletion(completed) {
  const { data } = await client.get('/tasks', { params: { completed } });
  return data;
}


// Fetches every task linked to a specific animal — used by the animal
// profile's detail view, alongside its dosage records.
export async function fetchTasksByAnimal(animalId) {
  const { data } = await client.get('/tasks', { params: { animal_id: animalId } });
  return data;
}


// Creates a new task. The component passes camelCase fields; the backend
// accepts either camelCase or snake_case and attaches the current user itself.

export async function createTask(taskData) {
  const errors = validateTaskData(taskData);
  if (errors) throw new Error(JSON.stringify(errors));

  const { data } = await client.post('/tasks', taskData);
  return data;
}


// Flips the completed state for a single task.
export async function toggleTaskComplete(id, completed) {
  const { data } = await client.patch(`/tasks/${id}/complete`, { completed });
  return data;
}


// Full update — replaces all editable fields of an existing task.
export async function updateTask(id, taskData) {
  const errors = validateTaskData(taskData);
  if (errors) throw new Error(JSON.stringify(errors));

  const { data } = await client.put(`/tasks/${id}`, taskData);
  return data;
}


// Permanently deletes a task. There's no soft-delete here — it's gone.
export async function deleteTask(id) {
  await client.delete(`/tasks/${id}`);
}
