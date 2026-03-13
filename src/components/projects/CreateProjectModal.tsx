import { useState } from "react";
import { Modal } from "../ui/Modal";
import { DatePicker } from "../ui/DatePicker";
import { ColorPicker } from "./ColorPicker";
import type { ProjectColor } from "../../types/database.types";
import type { CreateProjectData } from "../../hooks/useProjects";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateProjectData) => void;
}

export function CreateProjectModal({
  open,
  onClose,
  onCreate,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<ProjectColor>("violet");
  const [deadline, setDeadline] = useState("");

  function handleClose() {
    setName("");
    setDescription("");
    setColor("violet");
    setDeadline("");
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name,
      description,
      color,
      deadline: deadline || null,
    });
    handleClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="New project">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">
            Project name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Website Redesign"
            maxLength={80}
            className="w-full bg-white/4 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-400/50 focus:bg-white/6 transition-all"
            required
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">
            Description{" "}
            <span className="text-white/25 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
            rows={2}
            maxLength={300}
            className="w-full bg-white/4 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-400/50 focus:bg-white/6 transition-all resize-none"
          />
        </div>

        {/* Deadline */}
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">
            Deadline{" "}
            <span className="text-white/25 font-normal">(optional)</span>
          </label>
          <DatePicker value={deadline} onChange={setDeadline} />
        </div>

        {/* Color */}
        <ColorPicker
          value={color}
          onChange={setColor}
          projectName={name}
          projectDescription={description}
        />

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-violet-500/80 hover:bg-violet-500 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create project
          </button>
        </div>
      </form>
    </Modal>
  );
}
