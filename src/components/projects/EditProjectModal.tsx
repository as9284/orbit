import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { DatePicker } from "../ui/DatePicker";
import { ColorPicker } from "./ColorPicker";
import type { Project, ProjectColor } from "../../types/database.types";
import type { CreateProjectData } from "../../hooks/useProjects";

interface EditProjectModalProps {
  project: Project | null;
  onClose: () => void;
  onSave: (id: string, data: Partial<CreateProjectData>) => void;
}

export function EditProjectModal({
  project,
  onClose,
  onSave,
}: EditProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<ProjectColor>("violet");
  const [deadline, setDeadline] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description);
      setColor(project.color);
      setDeadline(project.deadline ?? "");
    }
  }, [project]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !name.trim()) return;
    onSave(project.id, {
      name,
      description,
      color,
      deadline: deadline || null,
    });
    onClose();
  }

  return (
    <Modal open={!!project} onClose={onClose} title="Edit project">
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
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-violet-500/80 hover:bg-violet-500 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}
