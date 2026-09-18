import React, { useState, useEffect, useMemo } from 'react';
import './TaskList.css';
import { fetchTasks, createTask, toggleTaskComplete, deleteTask } from './TaskListAPI';
import { useConfirm } from '../shared/useConfirm';

// Defined outside the component so this array isn't re-created on every render
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];

export default function TaskList({ autoAdd, onClearAutoAdd }) {

  const { confirm, dialog } = useConfirm();
  const [tasks,    setTasks]    = useState([]);
  const [filter,   setFilter]   = useState('all'); // 'all' | 'active' | 'completed'
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [showForm, setShowForm] = useState(false);

  // When the Home dashboard "+" button navigates here, auto-open the add form
  useEffect(() => {
    if (autoAdd) {
      setShowForm(true);
      onClearAutoAdd?.();
    }
  }, [autoAdd]);

  const [formData, setFormData] = useState({
    title:       '',
    dueDate:     '',
    priority:    'Medium',
    isRepeating: false,
  });

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTasks();
      setTasks(data);
    } catch (err) {
      setError('Could not load tasks.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // useMemo so we don't re-filter the entire list on every unrelated re-render.
  // Incomplete tasks always come first (false < true numerically).
  const filteredTasks = useMemo(() => {
    let result;
    if (filter === 'active') {
      result = tasks.filter((t) => !t.completed);
    } else if (filter === 'completed') {
      result = tasks.filter((t) => t.completed);
    } else {
      result = tasks;
    }

    // sort so incomplete tasks float to the top
    return [...result].sort((a, b) => a.completed - b.completed);
  }, [tasks, filter]);

  function handleInputChange(e) {
    const { name, value, type, checked } = e.target;
    // Checkboxes have a `checked` property instead of `value`
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleAddTask(e) {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Task title is required.');
      return;
    }

    try {
      const newTask = await createTask({ ...formData, completed: false });
      // Prepend so the new task appears at the top of the list immediately
      setTasks((prev) => [newTask, ...prev]);
      setFormData({ title: '', dueDate: '', priority: 'Medium', isRepeating: false });
      setShowForm(false);
    } catch (err) {
      setError('Failed to add task.');
      console.error(err);
    }
  }

  async function handleToggle(task) {
    // Repeating tasks are designed to never be "done" — skip them
    if (task.isRepeating) return;
    const newCompleted = !task.completed;

    try {
      // Optimistic update: change the UI instantly so it feels snappy,
      // then confirm with the server. If it fails, we roll back below.
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, completed: newCompleted } : t
        )
      );

      await toggleTaskComplete(task.id, newCompleted);
    } catch (err) {
      // Server call failed — put the old value back so the UI stays accurate
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, completed: task.completed } : t
        )
      );
      setError('Failed to update task. Reverted.');
    }
  }

  async function handleDelete(task) {
    if (!await confirm('Delete this task?')) return;
    try {
      await deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      setError('Failed to delete task.');
    }
  }

  // Maps priority string to a CSS class like "priority-high" for color coding
  function priorityClass(priority) {
    return `priority-${priority.toLowerCase()}`;
  }

  return (
    <div className="task-list">
      {dialog}

      <div className="tl-header">
        <h2 className="section-title">Task List</h2>
        <button className="btn-primary" onClick={() => {
          if (showForm) setFormData({ title: '', dueDate: '', priority: 'Medium', isRepeating: false });
          setShowForm((p) => !p);
        }}>
          {showForm ? 'Cancel' : '+ Add Task'}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="tl-filters">
        {['all', 'active', 'completed'].map((f) => (
          <button
            key={f}
            className={`tl-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {showForm && (
        <form className="tl-form card" onSubmit={handleAddTask}>
          <h3 className="tl-form-title">New Task</h3>

          <label className="ap-label">
            Task Title *
            <input
              className="input-field"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g. Feed the chickens"
            />
          </label>

          <div className="tl-row">
            <label className="ap-label">
              Due Date
              <input
                className="input-field"
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleInputChange}
              />
            </label>

            <label className="ap-label">
              Priority
              <select
                className="input-field"
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="tl-repeat-label">
            <input
              type="checkbox"
              name="isRepeating"
              checked={formData.isRepeating}
              onChange={handleInputChange}
              className="tl-repeat-check"
            />
            Repeating task (stays active, cannot be completed)
          </label>

          <button type="submit" className="btn-primary">Save Task</button>
        </form>
      )}

      {loading && <p className="ap-loading">Loading tasks...</p>}
      {error   && <p className="ap-error">{error}</p>}
      {!loading && !error && filteredTasks.length === 0 && (
        <p className="ap-empty">No tasks here. Add one above!</p>
      )}

      <ul className="tl-items">
        {filteredTasks.map((task) => (
          <li
            key={task.id}
            className={`tl-item card ${task.completed ? 'completed' : ''} ${task.isRepeating ? 'repeating' : ''}`}
          >
            {/* Repeating tasks show a loop icon instead of a checkbox because they can't be completed */}
            {task.isRepeating ? (
              <span className="tl-repeat-icon" title="Repeating task">↻</span>
            ) : (
              <input
                type="checkbox"
                className="tl-checkbox"
                checked={task.completed}
                onChange={() => handleToggle(task)}
              />
            )}

            <div className="tl-body">
              <span className="tl-title">{task.title}</span>
              <div className="tl-meta">
                {task.dueDate && (
                  // Flip from YYYY-MM-DD to DD-MM-YYYY for display
                  <span className="tl-date">
                    Due: {task.dueDate.split('-').reverse().join('-')}
                  </span>
                )}
                <span className={`tl-priority ${priorityClass(task.priority)}`}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </span>
                {task.isRepeating && (
                  <span className="tl-repeat-badge">Repeating</span>
                )}
              </div>
            </div>

            <button
              className="btn-danger tl-delete"
              onClick={() => handleDelete(task)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
