export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      activity_events: {
        Row: {
          connection_id: string;
          id: string;
          occurred_at: string;
          payload: Json;
          provider_id: string;
          workspace_id: string;
        };
        Insert: {
          connection_id: string;
          id?: string;
          occurred_at: string;
          payload: Json;
          provider_id: string;
          workspace_id: string;
        };
        Update: {
          connection_id?: string;
          id?: string;
          occurred_at?: string;
          payload?: Json;
          provider_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_events_connection_id_workspace_id_fkey";
            columns: ["connection_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "activity_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          created_at: string;
          details: Json;
          id: string;
          workspace_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          details?: Json;
          id?: string;
          workspace_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          details?: Json;
          id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      connections: {
        Row: {
          config: Json;
          created_at: string;
          id: string;
          label: string;
          last_error: string | null;
          last_sync_at: string | null;
          owner_id: string;
          provider: string;
          provider_account_id: string;
          resources: Json;
          scope_version: number;
          status: string;
          workspace_id: string;
        };
        Insert: {
          config?: Json;
          created_at?: string;
          id?: string;
          label: string;
          last_error?: string | null;
          last_sync_at?: string | null;
          owner_id: string;
          provider: string;
          provider_account_id: string;
          resources?: Json;
          scope_version?: number;
          status?: string;
          workspace_id: string;
        };
        Update: {
          config?: Json;
          created_at?: string;
          id?: string;
          label?: string;
          last_error?: string | null;
          last_sync_at?: string | null;
          owner_id?: string;
          provider?: string;
          provider_account_id?: string;
          resources?: Json;
          scope_version?: number;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "connections_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      development_links: {
        Row: {
          evidence: Json;
          pull_request_id: string;
          work_item_id: string;
          workspace_id: string;
        };
        Insert: {
          evidence: Json;
          pull_request_id: string;
          work_item_id: string;
          workspace_id: string;
        };
        Update: {
          evidence?: Json;
          pull_request_id?: string;
          work_item_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "development_links_pull_request_id_workspace_id_fkey";
            columns: ["pull_request_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "pull_requests";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "development_links_work_item_id_workspace_id_fkey";
            columns: ["work_item_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "work_items";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "development_links_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      pull_requests: {
        Row: {
          connection_id: string;
          id: string;
          payload: Json;
          provider_id: string;
          repository: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          connection_id: string;
          id?: string;
          payload: Json;
          provider_id: string;
          repository: string;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          connection_id?: string;
          id?: string;
          payload?: Json;
          provider_id?: string;
          repository?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pull_requests_connection_id_workspace_id_fkey";
            columns: ["connection_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "pull_requests_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      source_resources: {
        Row: {
          connection_id: string;
          id: string;
          kind: string;
          payload: Json;
          provider_id: string;
          workspace_id: string;
        };
        Insert: {
          connection_id: string;
          id?: string;
          kind: string;
          payload: Json;
          provider_id: string;
          workspace_id: string;
        };
        Update: {
          connection_id?: string;
          id?: string;
          kind?: string;
          payload?: Json;
          provider_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "source_resources_connection_id_workspace_id_fkey";
            columns: ["connection_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "source_resources_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_runs: {
        Row: {
          connection_id: string;
          error: string | null;
          finished_at: string | null;
          id: string;
          records_count: number;
          started_at: string;
          status: string;
          workspace_id: string;
        };
        Insert: {
          connection_id: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          records_count?: number;
          started_at?: string;
          status?: string;
          workspace_id: string;
        };
        Update: {
          connection_id?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          records_count?: number;
          started_at?: string;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sync_runs_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sync_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      work_items: {
        Row: {
          connection_id: string;
          id: string;
          issue_key: string;
          payload: Json;
          provider_id: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          connection_id: string;
          id?: string;
          issue_key: string;
          payload: Json;
          provider_id: string;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          connection_id?: string;
          id?: string;
          issue_key?: string;
          payload?: Json;
          provider_id?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_items_connection_id_workspace_id_fkey";
            columns: ["connection_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id", "workspace_id"];
          },
          {
            foreignKeyName: "work_items_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      enqueue_reconciliation: { Args: never; Returns: undefined };
      enqueue_sync: { Args: { p_id: string }; Returns: number };
      ensure_workspace: { Args: never; Returns: string };
      ingest_delivery: {
        Args: {
          p_connection_id: string;
          p_delivery_id: string;
          p_provider: string;
        };
        Returns: boolean;
      };
      publish_snapshot: {
        Args: {
          p_events: Json;
          p_id: string;
          p_lease: string;
          p_resources?: Json;
          p_rows: Json;
          p_scope_version: number;
        };
        Returns: undefined;
      };
      remove_connection: { Args: { p_id: string }; Returns: undefined };
      save_connection: {
        Args: {
          p_account_id: string;
          p_ciphertext: string;
          p_config: Json;
          p_label: string;
          p_provider: string;
        };
        Returns: string;
      };
      set_connection_scope: {
        Args: { p_id: string; p_resources: Json };
        Returns: undefined;
      };
      worker_ack: {
        Args: { p_archive?: boolean; p_msg_id: number };
        Returns: undefined;
      };
      worker_delay: {
        Args: { p_msg_id: number; p_seconds: number };
        Returns: undefined;
      };
      worker_lock: {
        Args: { p_id: string; p_lease: string; p_release?: boolean };
        Returns: boolean;
      };
      worker_read: { Args: never; Returns: Json };
      worker_secret: {
        Args: { p_ciphertext?: string; p_id: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
