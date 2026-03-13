export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          encryption_salt: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          encryption_salt?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          encryption_salt?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          archived: boolean;
          archived_at: string | null;
          completed: boolean;
          created_at: string;
          description: string | null;
          due_date: string | null;
          id: string;
          priority: Database["public"]["Enums"]["task_priority"];
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          archived_at?: string | null;
          completed?: boolean;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived?: boolean;
          archived_at?: string | null;
          completed?: boolean;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      sub_tasks: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          title: string;
          completed: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id: string;
          title: string;
          completed?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          user_id?: string;
          title?: string;
          completed?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      task_priority: "low" | "medium" | "high";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

// Convenience row types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type SubTask = Database["public"]["Tables"]["sub_tasks"]["Row"];
export type Note = Database["public"]["Tables"]["notes"]["Row"];

// ── Project type (localStorage-backed) ───────────────────────────────────────

export type ProjectColor =
  | "violet"
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "cyan"
  | "orange"
  | "pink";

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  color: ProjectColor;
  deadline: string | null;
  taskIds: string[];
  noteIds: string[];
  createdAt: string;
  updatedAt: string;
}
