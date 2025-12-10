import { createClient } from "@/lib/db/server"
// crypto.randomUUID() is available globally in Node.js 19+ and all modern runtimes

// Types for action history
export type ActionType =
  | "create"
  | "update"
  | "delete"
  | "bulk_update"
  | "bulk_delete"
  | "import"
  | "sync"
  | "undo"
  | "merge"
export type EntityType =
  | "deal"
  | "participant"
  | "payout"
  | "assignment"
  | "event"
  | "merchant"
  | "setting"
  | "participant_merge"
  | "adjustment"

export interface LogActionParams {
  actionType: ActionType
  entityType: EntityType
  entityId: string
  entityName?: string
  previousData?: Record<string, any> | null
  newData?: Record<string, any> | null
  description: string
  batchId?: string
  requestId?: string
  userId?: string
}

export interface LogDebugParams {
  level: "debug" | "info" | "warn" | "error" | "fatal"
  source: "api" | "sync" | "import" | "client" | "cron" | "webhook"
  message: string
  metadata?: Record<string, any>
  requestId?: string
  userId?: string
}

/**
 * Log an action to the action_history table for audit/undo purposes
 * FAIL-SAFE: This function will never throw - always returns gracefully
 */
export async function logAction(params: LogActionParams): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("action_history")
      .insert({
        action_type: params.actionType,
        entity_type: params.entityType,
        entity_id: params.entityId,
        entity_name: params.entityName || null,
        previous_data: params.previousData || null,
        new_data: params.newData || null,
        description: params.description,
        batch_id: params.batchId || null,
        request_id: params.requestId || null,
        user_id: params.userId || null,
      })
      .select("id")
      .single()

    if (error) {
      console.error("[History] Failed to log action:", error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data.id }
  } catch (err) {
    // FAIL-SAFE: Never throw, just log and return
    console.error("[History] Exception logging action:", err)
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

/**
 * Log multiple actions as a batch (e.g., bulk updates)
 * FAIL-SAFE: This function will never throw - always returns gracefully
 */
export async function logBatchActions(
  actions: Omit<LogActionParams, "batchId">[],
  batchDescription?: string,
  requestId?: string,
): Promise<{ success: boolean; batchId?: string; error?: string }> {
  try {
    // Guard: if no actions, return early
    if (!actions || actions.length === 0) {
      return { success: true, batchId: undefined }
    }

    const supabase = await createClient()
    const batchId = globalThis.crypto.randomUUID()

    // Insert batch summary action
    if (batchDescription) {
      await supabase.from("action_history").insert({
        action_type: "bulk_update",
        entity_type: actions[0]?.entityType || "deal",
        entity_id: batchId,
        entity_name: `Batch of ${actions.length} actions`,
        description: batchDescription,
        batch_id: batchId,
        request_id: requestId || null,
        new_data: { count: actions.length },
      })
    }

    // Insert individual actions with batch_id
    const records = actions.map((action) => ({
      action_type: action.actionType,
      entity_type: action.entityType,
      entity_id: action.entityId,
      entity_name: action.entityName || null,
      previous_data: action.previousData || null,
      new_data: action.newData || null,
      description: action.description,
      batch_id: batchId,
      request_id: requestId || null,
      user_id: action.userId || null,
    }))

    const { error } = await supabase.from("action_history").insert(records)

    if (error) {
      console.error("[History] Failed to log batch actions:", error)
      return { success: false, error: error.message }
    }

    return { success: true, batchId }
  } catch (err) {
    // FAIL-SAFE: Never throw, just log and return
    console.error("[History] Exception logging batch actions:", err)
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

/**
 * Undo an action by its ID
 * FAIL-SAFE: This function will never throw - always returns gracefully
 */
export async function undoAction(actionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get the original action
    const { data: action, error: fetchError } = await supabase
      .from("action_history")
      .select("*")
      .eq("id", actionId)
      .single()

    if (fetchError || !action) {
      return { success: false, error: "Action not found" }
    }

    if (action.is_undone) {
      return { success: false, error: "Action already undone" }
    }

    if (!action.previous_data) {
      return { success: false, error: "No previous data to restore" }
    }

    // Restore the previous data based on entity type
    let restoreError: string | null = null

    switch (action.entity_type) {
      case "deal":
        const { error: dealError } = await supabase
          .from("deals")
          .update(action.previous_data)
          .eq("deal_id", action.entity_id)
        restoreError = dealError?.message || null
        break

      case "payout":
        const { error: payoutError } = await supabase
          .from("csv_data")
          .update(action.previous_data)
          .eq("id", action.entity_id)
        restoreError = payoutError?.message || null
        break

      case "participant":
        const { error: participantError } = await supabase
          .from("participants")
          .update(action.previous_data)
          .eq("id", action.entity_id)
        restoreError = participantError?.message || null
        break

      case "assignment":
        const { error: assignmentError } = await supabase
          .from("deal_participants")
          .update(action.previous_data)
          .eq("id", action.entity_id)
        restoreError = assignmentError?.message || null
        break

      default:
        return { success: false, error: `Undo not supported for entity type: ${action.entity_type}` }
    }

    if (restoreError) {
      return { success: false, error: restoreError }
    }

    // Mark the original action as undone
    const undoActionId = globalThis.crypto.randomUUID()

    await supabase
      .from("action_history")
      .update({
        is_undone: true,
        undone_at: new Date().toISOString(),
        undo_action_id: undoActionId,
      })
      .eq("id", actionId)

    // Log the undo action itself (fire-and-forget, don't await)
    logAction({
      actionType: "undo",
      entityType: action.entity_type,
      entityId: action.entity_id,
      entityName: action.entity_name,
      previousData: action.new_data,
      newData: action.previous_data,
      description: `Undid: ${action.description}`,
    }).catch(() => {}) // Silently ignore any errors

    return { success: true }
  } catch (err) {
    // FAIL-SAFE: Never throw, just log and return
    console.error("[History] Exception undoing action:", err)
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

/**
 * Log a debug entry to the debug_logs table
 * FAIL-SAFE: This function will never throw - fires and forgets
 * Support both object params and individual args for backwards compatibility
 */
export async function logDebug(
  levelOrParams: LogDebugParams["level"] | LogDebugParams,
  source?: LogDebugParams["source"],
  message?: string,
  metadata?: Record<string, any>,
  requestId?: string,
): Promise<void> {
  try {
    const supabase = await createClient()

    // Support both calling styles
    let params: LogDebugParams
    if (typeof levelOrParams === "object") {
      params = levelOrParams
    } else {
      params = {
        level: levelOrParams,
        source: source!,
        message: message!,
        metadata,
        requestId,
      }
    }

    await supabase.from("debug_logs").insert({
      level: params.level,
      source: params.source,
      message: params.message,
      metadata: params.metadata || null,
      request_id: params.requestId || null,
      user_id: params.userId || null,
    })
  } catch (err) {
    // FAIL-SAFE: Silently fail - logging should never break the app
    console.error("[Debug] Failed to log:", err)
  }
}

/**
 * Helper to generate a unique request ID for correlating logs
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Fire-and-forget wrapper for logging actions
 * Use this when you don't need to wait for the log to complete
 */
export function logActionAsync(params: LogActionParams): void {
  logAction(params).catch(() => {}) // Fire and forget, never throws
}

/**
 * Fire-and-forget wrapper for logging batch actions
 * Use this when you don't need to wait for the log to complete
 */
export function logBatchActionsAsync(
  actions: Omit<LogActionParams, "batchId">[],
  batchDescription?: string,
  requestId?: string,
): void {
  logBatchActions(actions, batchDescription, requestId).catch(() => {}) // Fire and forget
}
