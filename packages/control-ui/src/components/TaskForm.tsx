import { useState, type FC, type FormEvent } from "react";

interface TaskFormProps {
  onCreate: (title: string, description: string, priority: string) => void;
  disabled?: boolean;
}

export const TaskForm: FC<TaskFormProps> = ({ onCreate, disabled = false }) => {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("normal");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate(title.trim(), "", priority);
    setTitle("");
    setPriority("normal");
  };

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <input
        className="input"
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={disabled}
      />
      <div className="task-form__row">
        <input
          className="input"
          placeholder="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          disabled={disabled}
        />
        <button className="btn btn--primary btn--small" type="submit" disabled={disabled || !title.trim()}>
          Create
        </button>
      </div>
    </form>
  );
};
