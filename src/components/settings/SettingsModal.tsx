import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
  type ReactNode,
} from "react";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import {
  encrypt,
  decrypt,
  deriveKey,
  generateSalt,
} from "../../lib/encryption";
import {
  validateFullName,
  validateEmail,
  validatePassword,
} from "../../lib/validations";
import {
  User,
  ShieldCheck,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  BrainCircuit,
  ExternalLink,
  LogOut,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  getAiSettings,
  saveAiSettings,
  PROVIDERS,
  PROVIDER_LIST,
  type AiSettings,
  type ProviderId,
  type ModelConfig,
} from "../../lib/ai";

type Tab = "account" | "security" | "ai" | "danger";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("account");
  const TABS: {
    id: Tab;
    label: string;
    shortLabel?: string;
    icon: ReactNode;
  }[] = [
    { id: "account", label: "Account", icon: <User size={12} /> },
    { id: "security", label: "Security", icon: <ShieldCheck size={12} /> },
    { id: "ai", label: "Luna", icon: <BrainCircuit size={12} /> },
    {
      id: "danger",
      label: "Danger zone",
      shortLabel: "Danger",
      icon: <Trash2 size={12} />,
    },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Settings" maxWidth="max-w-md">
      {/* Tab bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mb-5 p-1 bg-white/4 border border-white/[0.07] rounded-xl">
        {TABS.map(({ id, label, shortLabel, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              tab === id
                ? id === "danger"
                  ? "bg-red-500/15 text-red-400 shadow-sm shadow-red-500/10"
                  : "bg-linear-to-r from-violet-500 to-blue-500 text-white shadow-sm shadow-violet-500/20"
                : id === "danger"
                  ? "text-white/30 hover:text-red-400/60 hover:bg-red-500/5"
                  : "text-white/35 hover:text-white/60 hover:bg-white/5"
            }`}
          >
            {icon}
            <span className="sm:hidden">{shortLabel ?? label}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "account" && <AccountTab />}
      {tab === "security" && <SecurityTab />}
      {tab === "ai" && <AITab />}
      {tab === "danger" && <DangerTab onClose={onClose} />}
    </Modal>
  );
}

// ── Account Tab ───────────────────────────────────────────────────────────────

function AccountTab() {
  const { user, signOut } = useAuth();

  const currentName: string = user?.user_metadata?.full_name ?? "";
  const currentEmail: string = user?.email ?? "";

  // Name section
  const [nameEditing, setNameEditing] = useState(false);
  const [newName, setNewName] = useState(currentName);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  // Email section
  const [emailEditing, setEmailEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleSaveName = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateFullName(newName);
    if (err) {
      setNameError(err);
      return;
    }
    setNameLoading(true);
    setNameError(null);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: newName.trim() },
    });
    if (!error) {
      await supabase
        .from("profiles")
        .update({ full_name: newName.trim() })
        .eq("id", user!.id);
    }
    setNameLoading(false);
    if (error) {
      setNameError(error.message);
      return;
    }
    setNameEditing(false);
    setNameSuccess(true);
    setTimeout(() => setNameSuccess(false), 3000);
  };

  const handleChangeEmail = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateEmail(newEmail);
    if (err) {
      setEmailError(err);
      return;
    }
    if (newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      setEmailError("This is already your current email address.");
      return;
    }
    setEmailLoading(true);
    setEmailError(null);
    const { error } = await supabase.auth.updateUser({
      email: newEmail.trim().toLowerCase(),
    });
    setEmailLoading(false);
    if (error) {
      setEmailError(error.message);
      return;
    }
    setEmailSent(true);
    setEmailEditing(false);
    setNewEmail("");
  };

  return (
    <div className="space-y-4">
      {/* Full name */}
      <SettingsSection label="Full name">
        {nameEditing ? (
          <form onSubmit={handleSaveName} className="space-y-2.5">
            <input
              type="text"
              autoFocus
              value={newName}
              maxLength={100}
              onChange={(e) => {
                setNewName(e.target.value);
                setNameError(null);
              }}
              className={fieldInputClass(!!nameError)}
            />
            {nameError && <FieldError msg={nameError} />}
            <div className="flex gap-2">
              <SecondaryBtn
                type="button"
                onClick={() => {
                  setNameEditing(false);
                  setNewName(currentName);
                  setNameError(null);
                }}
              >
                Cancel
              </SecondaryBtn>
              <PrimaryBtn loading={nameLoading}>Save</PrimaryBtn>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/75">
              {currentName || (
                <span className="text-white/30 italic text-xs">Not set</span>
              )}
            </span>
            {nameSuccess ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <CheckCircle2 size={12} /> Saved
              </span>
            ) : (
              <EditBtn onClick={() => setNameEditing(true)} />
            )}
          </div>
        )}
      </SettingsSection>

      {/* Email */}
      <SettingsSection label="Email address">
        {emailSent ? (
          <InlineAlert
            color="emerald"
            icon={<CheckCircle2 size={13} />}
            msg="Email address updated. You may need to sign out and back in to see the change."
          />
        ) : emailEditing ? (
          <form onSubmit={handleChangeEmail} className="space-y-2.5">
            <input
              type="email"
              autoFocus
              autoComplete="email"
              placeholder={currentEmail}
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                setEmailError(null);
              }}
              className={fieldInputClass(!!emailError)}
            />
            {emailError && <FieldError msg={emailError} />}
            <p className="text-[11px] text-white/30">
              Your email address will be updated immediately.
            </p>
            <div className="flex gap-2">
              <SecondaryBtn
                type="button"
                onClick={() => {
                  setEmailEditing(false);
                  setNewEmail("");
                  setEmailError(null);
                }}
              >
                Cancel
              </SecondaryBtn>
              <PrimaryBtn loading={emailLoading}>Send confirmation</PrimaryBtn>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/75">{currentEmail}</span>
            <EditBtn onClick={() => setEmailEditing(true)} />
          </div>
        )}
      </SettingsSection>

      {/* Sign out */}
      <div className="pt-1">
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3.5 py-2.5 rounded-xl border border-red-500/15 bg-red-500/5 text-xs font-semibold text-red-400/70 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/25 transition-all duration-200"
        >
          <LogOut size={13} strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── Security Tab ──────────────────────────────────────────────────────────────

function SecurityTab() {
  const { user, encryptionKey, setEncryptionKey } = useAuth();
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [errors, setErrors] = useState<{
    current?: string;
    new?: string;
    confirm?: string;
  }>({});
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {
      current: !currentPwd ? "Current password is required." : undefined,
      new: validatePassword(newPwd) ?? undefined,
      confirm: newPwd !== confirmPwd ? "Passwords do not match." : undefined,
    };
    if (errs.current || errs.new || errs.confirm) {
      setErrors(errs);
      return;
    }
    if (currentPwd === newPwd) {
      setErrors({
        new: "New password must be different from your current one.",
      });
      return;
    }

    setLoading(true);
    setErrors({});

    // 1. Verify current password via re-auth
    setLoadingMsg("Verifying password…");
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: currentPwd,
    });
    if (authErr) {
      setLoading(false);
      setErrors({ current: "Incorrect password." });
      return;
    }

    // 2. Fetch stored salt
    const { data: profile } = await supabase
      .from("profiles")
      .select("encryption_salt")
      .eq("id", user!.id)
      .single();

    if (!profile?.encryption_salt || !encryptionKey) {
      setLoading(false);
      setErrors({
        current:
          "Vault not initialised. Sign out and sign back in, then retry.",
      });
      return;
    }

    // 3. Fetch all tasks (only fields we need)
    setLoadingMsg("Reading vault…");
    const { data: allTasks, error: tasksErr } = await supabase
      .from("tasks")
      .select("id, title, description")
      .eq("user_id", user!.id);

    if (tasksErr) {
      setLoading(false);
      setErrors({ current: "Failed to read tasks: " + tasksErr.message });
      return;
    }

    // 4. Generate new salt + key
    setLoadingMsg("Generating new encryption key…");
    const newSalt = generateSalt();
    const newKey = await deriveKey(newPwd, newSalt);

    // 5. Re-encrypt all tasks with the new key
    if (allTasks && allTasks.length > 0) {
      setLoadingMsg(
        `Re-encrypting ${allTasks.length} task${allTasks.length !== 1 ? "s" : ""}…`,
      );
      for (const task of allTasks) {
        const plainTitle = await decrypt(task.title, encryptionKey);
        const encTitle = await encrypt(plainTitle, newKey);
        const plainDesc = task.description
          ? await decrypt(task.description, encryptionKey)
          : null;
        const encDesc = plainDesc ? await encrypt(plainDesc, newKey) : null;
        const { error: updateErr } = await supabase
          .from("tasks")
          .update({ title: encTitle, description: encDesc })
          .eq("id", task.id);
        if (updateErr) {
          await supabase
            .from("profiles")
            .update({ encryption_salt: newSalt })
            .eq("id", user!.id);
          await setEncryptionKey(newKey);
          setLoading(false);
          setErrors({
            current:
              "Re-encryption failed partway. Please sign out and sign back in.",
          });
          return;
        }
      }
    }

    // 5b. Re-encrypt all sub-tasks
    const { data: allSubTasks } = await supabase
      .from("sub_tasks")
      .select("id, title")
      .eq("user_id", user!.id);
    if (allSubTasks && allSubTasks.length > 0) {
      setLoadingMsg(
        `Re-encrypting ${allSubTasks.length} sub-task${allSubTasks.length !== 1 ? "s" : ""}…`,
      );
      for (const st of allSubTasks) {
        const plainTitle = await decrypt(st.title, encryptionKey);
        const encTitle = await encrypt(plainTitle, newKey);
        const { error: updateErr } = await supabase
          .from("sub_tasks")
          .update({ title: encTitle })
          .eq("id", st.id);
        if (updateErr) {
          await supabase
            .from("profiles")
            .update({ encryption_salt: newSalt })
            .eq("id", user!.id);
          await setEncryptionKey(newKey);
          setLoading(false);
          setErrors({
            current:
              "Re-encryption failed partway. Please sign out and sign back in.",
          });
          return;
        }
      }
    }

    // 5c. Re-encrypt all notes
    const { data: allNotes } = await supabase
      .from("notes")
      .select("id, title, content")
      .eq("user_id", user!.id);
    if (allNotes && allNotes.length > 0) {
      setLoadingMsg(
        `Re-encrypting ${allNotes.length} note${allNotes.length !== 1 ? "s" : ""}…`,
      );
      for (const note of allNotes) {
        const plainTitle = await decrypt(note.title, encryptionKey);
        const encTitle = await encrypt(plainTitle, newKey);
        const plainContent = note.content
          ? await decrypt(note.content, encryptionKey)
          : null;
        const encContent = plainContent
          ? await encrypt(plainContent, newKey)
          : null;
        const { error: updateErr } = await supabase
          .from("notes")
          .update({ title: encTitle, content: encContent })
          .eq("id", note.id);
        if (updateErr) {
          await supabase
            .from("profiles")
            .update({ encryption_salt: newSalt })
            .eq("id", user!.id);
          await setEncryptionKey(newKey);
          setLoading(false);
          setErrors({
            current:
              "Re-encryption failed partway. Please sign out and sign back in.",
          });
          return;
        }
      }
    }

    // 6. Persist the new salt
    setLoadingMsg("Saving…");
    await supabase
      .from("profiles")
      .update({ encryption_salt: newSalt })
      .eq("id", user!.id);

    // 7. Update the auth password
    const { error: pwdErr } = await supabase.auth.updateUser({
      password: newPwd,
    });
    if (pwdErr) {
      // Vault already re-encrypted — update key in context and report partial failure
      await setEncryptionKey(newKey);
      setLoading(false);
      setErrors({
        current:
          "Vault re-encrypted but password update failed: " + pwdErr.message,
      });
      return;
    }

    // 8. Update in-memory encryption key
    await setEncryptionKey(newKey);

    setLoading(false);
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
        <div className="w-11 h-11 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 size={20} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/85">
            Password updated
          </p>
          <p className="text-xs text-white/35 mt-1">
            Your vault has been re-encrypted with a new key.
          </p>
        </div>
        <button
          onClick={() => setSuccess(false)}
          className="mt-1 text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          Change again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <PasswordField
        label="Current password"
        value={currentPwd}
        onChange={(v) => {
          setCurrentPwd(v);
          setErrors((p) => ({ ...p, current: undefined }));
        }}
        show={showCurrent}
        onToggleShow={() => setShowCurrent((v) => !v)}
        error={errors.current}
        autoComplete="current-password"
        placeholder="Your current password"
      />
      <PasswordField
        label="New password"
        value={newPwd}
        onChange={(v) => {
          setNewPwd(v);
          setErrors((p) => ({ ...p, new: undefined }));
        }}
        show={showNew}
        onToggleShow={() => setShowNew((v) => !v)}
        error={errors.new}
        autoComplete="new-password"
        placeholder="8+ chars, uppercase, number, symbol"
      />
      <PasswordField
        label="Confirm new password"
        value={confirmPwd}
        onChange={(v) => {
          setConfirmPwd(v);
          setErrors((p) => ({ ...p, confirm: undefined }));
        }}
        show={showConfirm}
        onToggleShow={() => setShowConfirm((v) => !v)}
        error={errors.confirm}
        autoComplete="new-password"
        placeholder="Repeat new password"
      />
      <p className="text-[11px] text-white/25 leading-relaxed">
        All tasks, sub-tasks, and notes in your vault will be re-encrypted with
        a new key derived from your new password.
      </p>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-linear-to-r from-violet-500 to-blue-500 text-white text-sm font-semibold rounded-xl hover:brightness-110 active:scale-[0.98] transition-all duration-150 shadow-md shadow-violet-500/15 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Spinner size={14} className="text-white" />
            {loadingMsg}
          </>
        ) : (
          "Update password"
        )}
      </button>
    </form>
  );
}

// ── Luna Tab ──────────────────────────────────────────────────────────────────

function AITab() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AiSettings>(getAiSettings);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cleared, setCleared] = useState(false);

  const provider = PROVIDERS[settings.provider];
  const currentKey = settings.keys[settings.provider] ?? "";

  const update = (patch: Partial<AiSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveAiSettings(next);
      return next;
    });
  };

  const handleProviderChange = (id: ProviderId) => {
    update({ provider: id });
  };

  const handleKeyChange = (value: string) => {
    const keys = { ...settings.keys, [settings.provider]: value };
    update({ keys });
    setSaved(false);
  };

  const handleKeySave = (e: FormEvent) => {
    e.preventDefault();
    saveAiSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleModelChange = (modelId: string) => {
    const model = { ...settings.model, [settings.provider]: modelId };
    update({ model });
  };

  const allFeaturesOn = Object.values(settings.features).every(Boolean);

  const handleToggleAll = () => {
    const next = !allFeaturesOn;
    const features: typeof settings.features = {
      autoCategorize: next,
      noteTools: next,
      lunaChat: next,
      meetingMode: next,
      writingAssistant: next,
    };
    update({ features });
  };

  const handleClearCategories = () => {
    const userId = user!.id;
    localStorage.removeItem(`orbit:categories:${userId}`);
    localStorage.removeItem(`orbit:note-categories:${userId}`);
    window.dispatchEvent(
      new CustomEvent("orbit:categories:cleared", { detail: { userId } }),
    );
    window.dispatchEvent(
      new CustomEvent("orbit:note-categories:cleared", { detail: { userId } }),
    );
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Provider selector */}
      <SettingsSection label="AI provider">
        <div className="grid grid-cols-2 gap-2">
          {PROVIDER_LIST.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProviderChange(p.id)}
              className={`text-left px-3 py-2.5 rounded-xl border transition-all duration-200 ${
                settings.provider === p.id
                  ? "border-violet-500/40 bg-violet-500/10"
                  : "border-white/8 bg-white/[0.035] hover:border-white/15"
              }`}
            >
              <span className="text-xs font-semibold text-white/80">
                {p.label}
              </span>
              <p className="text-[10px] text-white/30 mt-0.5 leading-snug">
                {p.description}
              </p>
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* API key */}
      <SettingsSection label={`${provider.label} API key`}>
        <form onSubmit={handleKeySave} className="space-y-2.5">
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-white/8 bg-white/4 focus-within:border-violet-500/30 focus-within:bg-white/5 transition-colors duration-200">
            <input
              type={show ? "text" : "password"}
              value={currentKey}
              placeholder={provider.keyPlaceholder}
              autoComplete="off"
              onChange={(e) => handleKeyChange(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-white/90 text-sm placeholder:text-white/25 outline-none font-mono"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShow((v) => !v)}
              className="text-white/30 hover:text-white/60 transition-colors shrink-0"
              aria-label={show ? "Hide key" : "Show key"}
            >
              {show ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <PrimaryBtn loading={false} disabled={!currentKey.trim()}>
              Save key
            </PrimaryBtn>
            {saved && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <CheckCircle2 size={12} /> Saved
              </span>
            )}
          </div>
        </form>

        {/* How-to guide */}
        <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/2.5 p-3.5 space-y-2.5">
          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">
            How to get a key
          </p>
          <ol className="space-y-1.5">
            {provider.docsSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="shrink-0 w-4 h-4 mt-0.5 flex items-center justify-center rounded-full bg-violet-500/15 text-violet-400/80 text-[9px] font-bold">
                  {i + 1}
                </span>
                <span className="text-[11px] text-white/35 leading-relaxed">
                  {i === 0 ? (
                    <>
                      Go to{" "}
                      <a
                        href={provider.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400/80 hover:text-violet-300 transition-colors inline-flex items-center gap-0.5"
                      >
                        {provider.docsUrl.replace("https://", "")}{" "}
                        <ExternalLink size={10} />
                      </a>{" "}
                      and create an account
                    </>
                  ) : (
                    step
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-[10px] text-white/20 leading-relaxed pt-0.5 border-t border-white/6">
            Your key is stored only in this browser and never sent to our
            servers. Luna sends only task titles and descriptions to{" "}
            {provider.label}.
          </p>
        </div>
      </SettingsSection>

      {/* Model selector */}
      <SettingsSection label="Model">
        <ModelDropdown
          models={provider.models}
          value={settings.model[settings.provider] ?? provider.defaultModel}
          onChange={handleModelChange}
        />
      </SettingsSection>

      <SettingsSection label="Features">
        <label className="flex items-center justify-between gap-3 py-1 cursor-pointer group">
          <div className="min-w-0">
            <span className="text-xs text-white/70 font-medium group-hover:text-white/90 transition-colors">
              Enable all AI features
            </span>
            <p className="text-[10px] text-white/25 mt-0.5 leading-snug">
              Luna chat, Meeting Mode, Writing Assistant, auto-categorize, and
              note AI tools
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={allFeaturesOn}
            onClick={handleToggleAll}
            className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ${
              allFeaturesOn ? "bg-violet-500" : "bg-white/10"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                allFeaturesOn ? "translate-x-4" : ""
              }`}
            />
          </button>
        </label>
        {!currentKey.trim() && (
          <p className="text-[10px] text-amber-400/60 mt-2">
            Add an API key above to enable AI features.
          </p>
        )}
      </SettingsSection>

      {/* Clear categories */}
      {currentKey.trim() && settings.features.autoCategorize && (
        <SettingsSection label="Categories">
          {cleared ? (
            <InlineAlert
              color="emerald"
              icon={<CheckCircle2 size={13} />}
              msg="All categories cleared. They will be re-generated the next time you open the tasks and notes pages."
            />
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">
                Clear Luna categories and re-run analysis
              </span>
              <button
                type="button"
                onClick={handleClearCategories}
                className="text-[11px] font-semibold text-white/35 hover:text-violet-400 hover:bg-violet-500/8 transition-all duration-200 px-2.5 py-1 rounded-lg whitespace-nowrap ml-3"
              >
                Clear all
              </button>
            </div>
          )}
        </SettingsSection>
      )}
    </div>
  );
}

// ── Danger Tab ────────────────────────────────────────────────────────────────

function DangerTab({ onClose }: { onClose: () => void }) {
  const { user, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Password is required.");
      return;
    }
    setLoading(true);
    setError(null);

    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password,
    });
    if (authErr) {
      setLoading(false);
      setError("Incorrect password.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcErr } = await (supabase.rpc as any)("delete_account");
    if (rpcErr) {
      setLoading(false);
      setError(rpcErr.message);
      return;
    }

    onClose();
    await signOut();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/6 border border-red-500/20">
        <AlertCircle size={15} className="text-red-400/90 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-red-400">
            Permanent deletion
          </p>
          <p className="text-[11px] text-red-400/55 mt-0.5 leading-relaxed">
            This will permanently delete your account, all tasks, and all
            encrypted data. This action cannot be undone.
          </p>
        </div>
      </div>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full py-2.5 bg-red-500/10 text-red-400 text-sm font-semibold border border-red-500/20 rounded-xl hover:bg-red-500/15 hover:border-red-500/30 transition-all duration-200"
        >
          Delete my account
        </button>
      ) : (
        <form onSubmit={handleDelete} noValidate className="space-y-3">
          <PasswordField
            label="Confirm with your password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              setError(null);
            }}
            show={showPwd}
            onToggleShow={() => setShowPwd((v) => !v)}
            error={error ?? undefined}
            autoComplete="current-password"
            placeholder="Your current password"
          />
          <div className="flex gap-2">
            <SecondaryBtn
              type="button"
              onClick={() => {
                setConfirming(false);
                setPassword("");
                setError(null);
              }}
            >
              Cancel
            </SecondaryBtn>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Spinner size={13} className="text-white" />}
              Delete permanently
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Model Dropdown ────────────────────────────────────────────────────────────

function ModelDropdown({
  models,
  value,
  onChange,
}: {
  models: ModelConfig[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = models.find((m) => m.id === value) ?? models[0];

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-200 ${
          open
            ? "border-violet-500/30 bg-white/6"
            : "border-white/8 bg-white/4 hover:border-white/15"
        }`}
      >
        <span className="flex-1 text-left text-white/80 font-medium">
          {selected?.label ?? value}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selected?.free && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/15 text-[9px] font-semibold text-emerald-400/80 uppercase tracking-wider">
              Free
            </span>
          )}
          {selected?.supportsThinking && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/15 text-[9px] font-semibold text-amber-400/80 uppercase tracking-wider">
              Think
            </span>
          )}
        </div>
        <ChevronDown
          size={12}
          className={`shrink-0 text-white/30 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1.5 rounded-xl border border-white/9 bg-orbit-900 shadow-2xl shadow-black/60 overflow-hidden">
          {models.map((m) => {
            const active = m.id === value;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs transition-colors duration-150 ${
                  active
                    ? "bg-violet-500/10 text-white/90"
                    : "text-white/55 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <span
                  className={`shrink-0 w-3.5 flex items-center justify-center ${
                    active ? "text-violet-400" : "text-transparent"
                  }`}
                >
                  <Check size={11} />
                </span>
                <span className="flex-1 text-left font-medium">{m.label}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {m.free && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/15 text-[9px] font-semibold text-emerald-400/80 uppercase tracking-wider">
                      Free
                    </span>
                  )}
                  {m.supportsThinking && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/15 text-[9px] font-semibold text-amber-400/80 uppercase tracking-wider">
                      Think
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function SettingsSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-1.5">
        {label}
      </p>
      <div className="rounded-xl border border-white/8 bg-white/[0.035] px-3.5 py-3">
        {children}
      </div>
    </div>
  );
}

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  error?: string;
  autoComplete?: string;
  placeholder?: string;
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  error,
  autoComplete,
  placeholder,
}: PasswordFieldProps) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-1.5">
        {label}
      </p>
      <div
        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border transition-colors duration-200 ${
          error
            ? "border-red-500/40 bg-red-500/5"
            : "border-white/8 bg-white/4 focus-within:border-violet-500/30 focus-within:bg-white/5"
        }`}
      >
        <input
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-white/90 text-sm placeholder:text-white/25 outline-none"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggleShow}
          className="text-white/30 hover:text-white/60 transition-colors shrink-0"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
      {error && <FieldError msg={error} />}
    </div>
  );
}

function fieldInputClass(hasError: boolean) {
  return `w-full px-3.5 py-2.5 rounded-xl border bg-white/[0.04] text-white/90 text-sm placeholder:text-white/25 outline-none transition-colors duration-200 ${
    hasError
      ? "border-red-500/40"
      : "border-white/[0.08] focus:border-violet-500/30 focus:bg-white/5"
  }`;
}

function FieldError({ msg }: { msg: string }) {
  return <p className="mt-1 text-[11px] text-red-400">{msg}</p>;
}

function InlineAlert({
  color,
  icon,
  msg,
}: {
  color: "emerald" | "red";
  icon: ReactNode;
  msg: string;
}) {
  const cls =
    color === "emerald"
      ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-400/80"
      : "bg-red-500/8 border-red-500/20 text-red-400/80";
  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-xl border text-xs leading-relaxed ${cls}`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      {msg}
    </div>
  );
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-semibold text-white/35 hover:text-violet-400 hover:bg-violet-500/8 transition-all duration-200 px-2.5 py-1 rounded-lg"
    >
      Edit
    </button>
  );
}

function PrimaryBtn({
  children,
  loading,
  disabled,
  type = "submit",
}: {
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  type?: "submit" | "button" | "reset";
}) {
  return (
    <button
      type={type}
      disabled={loading || disabled}
      className="flex-1 py-2 text-sm font-semibold bg-linear-to-r from-violet-500 to-blue-500 text-white rounded-xl hover:brightness-110 active:scale-[0.98] transition-all duration-150 shadow-sm shadow-violet-500/15 disabled:opacity-50 flex items-center justify-center gap-1.5"
    >
      {loading && <Spinner size={13} className="text-white" />}
      {children}
    </button>
  );
}

function SecondaryBtn({
  children,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "submit" | "button" | "reset";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="flex-1 py-2 text-sm font-medium text-white/40 border border-white/8 rounded-xl hover:bg-white/4 hover:text-white/55 transition-all duration-200"
    >
      {children}
    </button>
  );
}
